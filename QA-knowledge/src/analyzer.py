from __future__ import annotations

from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .models import Evidence, ExternalAsset, PageAnalysis, PageLink, UIElement


def _clean(text: str | None) -> str:
    return " ".join((text or "").split())


def _confidence(*, label: str = "", source: str = "", minimum: float = 0.45) -> float:
    score = minimum
    if label:
        score += 0.2
    if source:
        score += 0.15
    return min(score, 0.95)


def _is_external(base_url: str, href: str) -> bool:
    base_host = urlparse(base_url).netloc
    href_host = urlparse(href).netloc
    return bool(href_host and href_host != base_host)


def _label_for(element) -> str:
    aria = _clean(element.get("aria-label"))
    if aria:
        return aria
    text = _clean(element.get_text(" "))
    if text:
        return text
    placeholder = _clean(element.get("placeholder"))
    if placeholder:
        return placeholder
    value = _clean(element.get("value"))
    if value:
        return value
    name = _clean(element.get("name"))
    return name or _clean(element.get("id")) or "名称未取得"


def _link_source(anchor) -> str:
    for ancestor in anchor.parents:
        if ancestor.name in {"nav", "header", "footer"}:
            return f"{ancestor.name} a[href]"
    return "a[href]"


def analyze_html(url: str, html: str) -> PageAnalysis:
    soup = BeautifulSoup(html, "html.parser")

    title = _clean(soup.title.string if soup.title else "")
    description_tag = soup.find("meta", attrs={"name": "description"})
    description = _clean(description_tag.get("content") if description_tag else "")

    headings = []
    for heading in soup.find_all(["h1", "h2", "h3"]):
        text = _clean(heading.get_text(" "))
        if text and text not in headings:
            headings.append(text)

    links: list[PageLink] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(url, href)
        text = _label_for(anchor)
        source = _link_source(anchor)
        evidence = Evidence(
            source=source,
            text=text,
            confidence=_confidence(label=text, source=href, minimum=0.55 if source != "a[href]" else 0.5),
            needs_review=False,
        )
        links.append(PageLink(text=text, href=absolute, is_external=_is_external(url, absolute), evidence=evidence))

    inputs: list[UIElement] = []
    for field in soup.find_all(["input", "select", "textarea"]):
        kind = field.name
        input_type = _clean(field.get("type")) or kind
        label = _label_for(field)
        evidence = Evidence(
            source=kind,
            text=label,
            confidence=_confidence(label=label, source=input_type, minimum=0.55),
            needs_review=True,
        )
        inputs.append(UIElement(kind=kind, label=label, name=_clean(field.get("name")), input_type=input_type, evidence=evidence))

    actions: list[UIElement] = []
    for element in soup.find_all(["button", "input"]):
        if element.name == "input" and (element.get("type") or "").lower() not in {"button", "submit", "reset"}:
            continue
        label = _label_for(element)
        input_type = _clean(element.get("type")) or element.name
        evidence = Evidence(
            source=element.name,
            text=label,
            confidence=_confidence(label=label, source=input_type, minimum=0.6),
            needs_review=True,
        )
        actions.append(UIElement(kind=element.name, label=label, name=_clean(element.get("name")), input_type=input_type, evidence=evidence))

    forms: list[UIElement] = []
    for index, form in enumerate(soup.find_all("form"), start=1):
        action = _clean(form.get("action"))
        method = _clean(form.get("method")).upper() or "GET"
        label = _clean(form.get("aria-label")) or f"フォーム{index}"
        evidence = Evidence(source="form", text=f"{method} {action or '(current page)'}", confidence=0.7, needs_review=True)
        forms.append(UIElement(kind="form", label=label, name=action, input_type=method, evidence=evidence))

    external_assets: list[ExternalAsset] = []
    for tag_name, attr, kind in [("script", "src", "script"), ("link", "href", "stylesheet/image"), ("img", "src", "image")]:
        for tag in soup.find_all(tag_name):
            value = (tag.get(attr) or "").strip()
            if not value:
                continue
            absolute = urljoin(url, value)
            if _is_external(url, absolute):
                evidence = Evidence(source=f"{tag_name}[{attr}]", text=absolute, confidence=0.75, needs_review=True)
                external_assets.append(ExternalAsset(kind=kind, url=absolute, evidence=evidence))

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    body_text = _clean(soup.get_text(" "))
    return PageAnalysis(
        url=url,
        title=title or url,
        description=description,
        headings=headings[:40],
        links=links[:80],
        forms=forms[:30],
        actions=actions[:80],
        inputs=inputs[:100],
        external_assets=external_assets[:80],
        body_excerpt=body_text[:1600],
    )
