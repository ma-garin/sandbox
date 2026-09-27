// 生成側が本文に差し込む注記の文言。表示側（render/html-purpose.ts）は本文の書き出しでこの注記を
// 見分けて冒頭の callout に移すため、両側が同じ定数を参照する。ここの文言を変えると出力も変わる。

/** DESIGN_INTENT_NOTE の書き出し（表示側が本文からこの注記を見分けて callout に移すのに使う） */
export const DESIGN_INTENT_NOTE_PREFIX = '本書はソースから確定できる事実を記述する';

/** 設計意図は復元できない旨（D01・D02・D11・D12 の冒頭）。LLM が有効でも同じ */
export const DESIGN_INTENT_NOTE = `${DESIGN_INTENT_NOTE_PREFIX}。設計の意図・業務上の背景・値の選定理由はソースから復元できないため記述せず、D09（確認事項）に回す。LLM の説明文（推測）はこれらを補うものではない（出典: E. Chikofsky, J. Cross, "Reverse Engineering and Design Recovery: A Taxonomy", IEEE Software, 1990, DOI: 10.1109/52.43044）`;

/** 「説明文の欄は LLM 無効のため未生成」注記の書き出し（続きは呼び出し側で D09 番号を補って段落にする） */
export const LLM_DISABLED_NOTE_PREFIX = '説明文の欄は LLM 無効のため未生成';
