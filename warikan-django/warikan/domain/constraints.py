"""仕様書に定義された入力範囲・上限値。

出典はすべて Warikan仕様書 Ver.1.0。節番号をコメントで示す。
"""

# 1.2.1 自分側／相手側の人数
MIN_PEOPLE = 1
MAX_PEOPLE = 99

# 1.2.2 金額
MIN_AMOUNT = 1
MAX_AMOUNT = 999_999

# 1.2.3 支払いの割合（スライダー）
# 仕様は「初期状態で50」「10ずつ変化」とのみ記述し、上下限を明示していない。
# 本実装は 0〜100 と解釈する（docs/SPEC_ISSUES.md #1）。
MIN_RATIO = 0
MAX_RATIO = 100
RATIO_STEP = 10
DEFAULT_RATIO = 50

# 1.3 計算：100円単位切り上げ
ROUNDING_UNIT = 100

# 1.1.2 ログイン入力欄
USER_ID_MAX_LENGTH = 15
PASSWORD_MAX_LENGTH = 20

# 3. 割り勘結果登録
NOTE_MAX_LENGTH = 400
DATE_RANGE_YEARS = 3
TIME_STEP_MINUTES = 30
DEFAULT_HELD_TIME = "18:00"
