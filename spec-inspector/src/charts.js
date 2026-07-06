// charts.js — 依存なしのSVG描画（レーダーチャート・スコアバー）

// スコア→色（0:赤 → 100:緑）
export function scoreColor(v) {
  const hue = Math.round((v / 100) * 120); // 0=red,120=green
  return `hsl(${hue} 70% 45%)`;
}

// レーダーチャート。axes=[{label,value}], size px。前回値 prevValues があれば重ねて描画。
export function radarSVG(axes, { size = 320, prev = null } = {}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const n = axes.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, val) => {
    const rr = (val / 100) * r;
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))];
  };

  const rings = [25, 50, 75, 100].map((pct) => {
    const pts = axes.map((_, i) => point(i, pct).join(",")).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="var(--grid)" stroke-width="1"/>`;
  }).join("");

  const spokes = axes.map((_, i) => {
    const [x, y] = point(i, 100);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`;
  }).join("");

  const labels = axes.map((a, i) => {
    const [x, y] = point(i, 118);
    const anchor = Math.abs(x - cx) < 8 ? "middle" : x < cx ? "end" : "start";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-label">${a.label}</text>` +
           `<text x="${x}" y="${y + 14}" text-anchor="${anchor}" class="radar-val">${a.value}</text>`;
  }).join("");

  const curPts = axes.map((a, i) => point(i, a.value).join(",")).join(" ");
  const curPoly = `<polygon points="${curPts}" fill="var(--accent-fill)" stroke="var(--accent)" stroke-width="2"/>`;

  let prevPoly = "";
  if (prev && prev.length === n) {
    const p = prev.map((v, i) => point(i, v).join(",")).join(" ");
    prevPoly = `<polygon points="${p}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }

  const dots = axes.map((a, i) => {
    const [x, y] = point(i, a.value);
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--accent)"/>`;
  }).join("");

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="観点スコアのレーダーチャート">
    ${rings}${spokes}${prevPoly}${curPoly}${dots}${labels}
  </svg>`;
}

// 横スコアバー
export function scoreBar(label, value) {
  return `<div class="scorebar">
    <span class="scorebar-label">${label}</span>
    <span class="scorebar-track"><span class="scorebar-fill" style="width:${value}%;background:${scoreColor(value)}"></span></span>
    <span class="scorebar-num">${value}</span>
  </div>`;
}
