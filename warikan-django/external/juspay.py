"""ジャスPay（スマホ決済アプリ）連携部分（システムテスト対象外）。

Warikan の責務は「サービスサーバから取得したデータで QR コードを表示する」まで。
送金処理そのものは Warikan とは別アプリケーションで実現される（仕様 2）。
"""

import io

import segno


def build_qr_svg(payload: str, *, scale: int = 6) -> str:
    """支払データから QR コードの SVG 文字列を生成する。

    外部ファイルを作らず、テンプレートへ直接埋め込める形で返す。
    """
    if not payload:
        raise ValueError("QR コードのデータが空です")

    qr = segno.make(payload, error="m")
    buffer = io.BytesIO()
    qr.save(buffer, kind="svg", scale=scale, xmldecl=False, svgns=True, border=2)
    return buffer.getvalue().decode("utf-8")
