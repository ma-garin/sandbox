# design.md — UI/UX検証モジュール

## アーキテクチャ方針
**確立OSSの薄いオーケストレーション。** 検証エンジンは自作しない。
LLMは「エンジンへの入力生成」と「エンジン出力の解釈」に徹し、客観評価（axe/Lighthouse）と主観評価（Vision/ISO 25010）を分離する。

## パイプライン
```
[入力] URL or HTML
   │
   ▼
① capture.py     Playwright → スクショ + DOM + axe-core注入
   │                 └ axe-playwright-python（WCAG違反＝証拠）
   ▼
② lighthouse_runner.py  Lighthouse CLI → カテゴリスコア（証拠）
   │
   ▼
③ ux_evaluator.py  GPT-4o Vision（スクショ + axe + lighthouse）
   │                 └ ISO 25010 5サブ特性 / ISTQB severity / JSON強制 / Evidence-only
   ▼
④ report.py      ISO 29119-3形式レポート組み立て（Markdown）
   │
   ▼
[出力] Streamlit表示 + レポートDL
```

## モジュール責務
| ファイル | 責務 | 依存する確立技術 |
|---|---|---|
| `core/schema.py` | pydantic型定義（Severity / Finding / Result） | pydantic |
| `core/capture.py` | 描画・スクショ・axe実行 | Playwright, axe-playwright-python |
| `core/lighthouse_runner.py` | Lighthouse起動・結果パース | Lighthouse(Node CLI) |
| `core/ux_evaluator.py` | LLMによるUX評価 | OpenAI, (Langfuse任意) |
| `core/report.py` | ISO 29119レポート生成 | — |
| `app.py` | Streamlit UI（紺系design-system） | Streamlit |
| `evals/test_ux_eval.py` | 回帰テスト | DeepEval |

## データ構造（schema.py）
```python
class Severity(str, Enum):      # ISTQB
    CRITICAL = "Critical"
    MAJOR    = "Major"
    MINOR    = "Minor"
    COSMETIC = "Cosmetic"

class Finding(BaseModel):
    severity: Severity
    iso25010: str          # ユーザビリティ5サブ特性のいずれか
    title: str
    evidence: str          # 必須。axe rule id / lighthouse監査 / 可視要素の記述
    recommendation: str

class UXEvalResult(BaseModel):
    findings: list[Finding]
    summary: str
    a11y_score: float | None
    perf_score: float | None
```

## LLMプロンプト原則（Evidence-only / JSON強制）
- systemで「JSONのみ・前置き禁止・推測禁止・証拠の明示必須」を強制
- userに axe違反一覧 + Lighthouseスコア + スクショ画像を渡す
- `response_format={"type":"json_object"}` + `temperature=0`

## デザイン（design-system 紺系 #1a3a6b）
- Streamlitのカスタムテーマ + 最小CSSでサイドバー固定・ノースクロール準拠
- severityバッジは色分け（Critical=#c62828 等）

## グレースフルデグラデーション
- Lighthouse未インストール時はスコアnullで継続
- Playwright不可（ブラウザ無）の場合はアップロードHTMLの静的axe実行にフォールバック
