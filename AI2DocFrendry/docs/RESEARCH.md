# RESEARCH.md — 先行研究調査

> 調査日: 2026-07-21 ／ 版: 1.0
> 目的: 「生成AIが読み込みやすいドキュメントとは何か」を、**実証研究に基づいて**確定する。
> **v0.1（推測ベース）から全面書き換え。**旧版は根拠なく「Markdownは構造化されているので読みやすい」等を記述しており、本調査でその多くが否定された。

---

## 0. この文書の読み方

記述はすべて次の3つに分類してある。**混ぜて読まないこと。**

| 印 | 意味 |
|---|---|
| **【実証】** | 査読論文または効果量が公開された実験で確認されたもの |
| **【主張】** | 提唱・推奨されているが、実験的根拠が示されていないもの |
| **【未確認】** | 一次資料に到達できず、数値を保証できないもの |

調査方法: 6テーマを並行調査。うち5テーマ完了（形式比較の統制実験は継続中）。合計271回のツール実行、約52万トークン。各エージェントに「実証と主張の区別」「出典URL必須」「捏造禁止」「否定的結果も報告」を課した。

---

## 1. 結論

### 1-1. 最も重要な発見

**RAGの最終精度に対して、前処理（抽出・パース・構造保持）が支配的である。**【実証】

ColPali（ICLR 2025、arXiv:2407.01449）の統制実験が最も明快である。ingestionと埋め込みモデルを独立に動かして平均nDCG@5を測定した結果:

| 介入 | 効果 |
|---|---|
| 埋め込みモデルの入れ替え（BM25 → BGE-M3、ingestion固定） | **+0.6pt**（65.5 → 66.1） |
| ingestionにcaptioning追加（埋め込み固定） | **+0.9pt**（66.1 → 67.0） |
| ingestionを根本変更（OCR廃止・ページ画像を直接埋め込み） | **+15.2pt**（66.1 → 81.3） |

著者の逐語:
> "the primary performance bottleneck for efficient document retrieval stems **not from embedding model performance but from the prior data ingestion pipeline**"

同方向の証拠:
- **パーサ選択だけで最大22ポイント**（Databricks OfficeQA Pro, arXiv:2603.08655。89,000ページ・133問。ai_parse_document 50.4% / Docling 38.4% / unstructured.io 31.1%）【実証、ただし作成者の自社製品が1位】
- **OCRエンジン選択だけでnDCG@5が20.2ポイント**（DocDeg, arXiv:2505.05666。4,196文書・41,956問。Nougat 0.3212 → Llama3.2 90B 0.5229）【実証】
- **データ準備品質が支配的要因**（From PDF to RAG-Ready, Applied Sciences 2026。1,706ページ・50問・21構成・各50回実行・Wilcoxon検定）【実証】

### 1-2. ご質問への回答：「Markdownは本当に読みやすいのか」

**「Markdown記法そのものが優れている」ことを示した統制実験は、本調査では発見できなかった。**

- 記法について公開実験に言及しているベンダーは**OpenAIのGPT-4.1 Prompting Guideのみ**。それも生データ非公開【主張に近い】
- AnthropicのXMLタグ推奨に**実験的根拠の記載はない**【主張】
- 「ClaudeはXMLで訓練されている」は**公式が明確に否定**: "There are no canonical 'best' XML tags that Claude has been trained with in particular"
- 学術研究の結論は**「単一の最適形式は存在せず、モデルごとに異なる」**（arXiv:2411.10541）【実証】
  - GPT-3.5-turbo MMLU: **JSON 59.7% vs Markdown 50.0%**（JSON勝ち）
  - GPT-4 MMLU: **Markdown 81.2% vs JSON 73.9%**（Markdown勝ち）
  - 最適書式集合の重なり: 同一サブシリーズ内 IoU>0.7、**世代をまたぐと IoU<0.2**
- Anthropic自身が「形式の重要性は今後低下する」と述べている

**結論: Markdownを選ぶ根拠は「AIが読みやすいから」ではない。**「構造を表現でき、記法が冗長でなく、人間もレビューでき、既存ツールが出力できる最大公約数」として消去法で選ぶのが、証拠に忠実な位置づけである。

### 1-3. 補足: 記号そのものの効果は測れる。ただしMarkdownでは誰も測っていない

**Markdown記法（`##`、`|`、`**`）を内容同一のまま除去/付加した統制実験は、arXiv上に存在しない。**【空白】

一方、**対象記号は違うが同種の実験は3本存在する**。研究設計として成立しないわけではない。

- **arXiv:2510.13191**（2025）— 意味内容を完全に固定し、識別子の区切り記号だけを変化。**ハイフンを `&` に1文字置換しただけで LLaMA-2-7B-Chat の OAA が 0.810 → 0.102（−70.8pt）**【実証】※Figure 2 の他条件は未確認
- **arXiv:2606.11198**（2026）— KGトリプルの区切り記号が、意味的に等価な自然文よりトークンあたり2〜3倍のattentionを奪う（0.70 対 0.25）。**トリプルが有用かノイズかに関わらず発生**。記号除去（format flattening）による対照実験あり【実証・査読状況未確認】
- **arXiv:2505.12592 PromptPrism** — delimiter変更の影響を定量化する統制実験フレームワーク【効果量は未確認】

**→ 記号は大きく効きうる。にもかかわらずMarkdownについては誰も測っていない。**これは本プロジェクトが自ら検証できる空白である。

### 1-4. 一貫したパターン: 形式の効果はモデルが強くなるほど消える【実証】

| 研究 | 内容 | 結果 |
|---|---|---|
| arXiv:2602.05447（11モデル・SQL生成・9,649実験） | YAML/Markdown/JSON/TOON | **形式に有意差なし（χ²=2.45, p=0.484）。**frontier対OSSの21pt差が形式効果を圧倒 |
| arXiv:2604.21076（FHIR投薬照合・200患者×4,000推論） | Raw JSON 対 臨床叙述 | 8B以下では叙述が最大**+19 F1pt**優位、**70Bで逆転**（Raw JSON F1=0.9956） |
| arXiv:2607.03158（3モデル・5タスク・4,020実装） | 散文/LaTeX擬似コード/Markdown/YAML/JSON | **大型モデルでは形式差が消失**、小型では残存 |
| arXiv:2411.10541 | Markdown 対 JSON | GPT-3.5とGPT-4で優劣が逆転 |

OHRBench の「Formatting Noise はモデルが強いほど耐性が上がるが、Semantic Noise は誰も免れない」（§5-2）と完全に整合する。

**→ 書式の最適化は逓減資産、内容の正確性は逓減しない資産。**

---

## 2. 実証されていること（効果量付き）

### 2-1. 情報の欠落が最大の劣化要因【実証】

**OHRBench / "OCR Hinders RAG"**（ICCV 2025、arXiv:2412.02592。8,561画像・8,498QA・7ドメイン）

| 手法 | 総合スコア | Ground Truth比 |
|---|---|---|
| Ground Truth（人手構造化） | 36.1 | 基準 |
| Qwen2.5-VL-72B | 31.1 | −5.0pt |
| MinerU | 30.0 | −6.1pt |
| Nougat | 14.5 | **−21.6pt（−60%）** |

> "even the best OCR solutions exhibit a performance gap of **14% at least**, compared to the ground truth structured data"

証拠タイプ別では**チャートが壊滅的**（GT 32.9 → MinerU 9.3、**−72%**）。チャートを含む文書はOCRテキスト経路では救えない。

重度のSemantic Noise（文字認識誤り）で**約50%の性能低下**。かつ「密検索の理解力はOCRノイズへの耐性を与えない」。

### 2-2. OCR精度とRAG精度は乖離する【実証】

**InduOCRBench**（arXiv:2605.00911、570文書・3,402ページ・11カテゴリ）

| 文書タイプ | OCR精度 | RAG精度 | 差 |
|---|---|---|---|
| **VisualStyle**（打ち消し線・色強調） | 82.9% | **52.8%** | **−30.1pt** |
| MultiFont | 97.2% | 97.5% | +0.3pt |
| CrosspageTable | 40.7% | 63.8% | +23.1pt |

機序: OCRは文字を正確に読むが、**打ち消し線という「意味を担う書式」を捨てる**。結果、取り消されたはずの内容が有効な事実として下流に届く。

**→ CER/WER をKPIにしてはいけない。** 評価は自社ドメインのQAタスクで行う。

また標準ベンチのスコアは実務文書で**15〜28ポイント過大評価**される（MinerU2.5: OmniDocBench 90.7% → InduOCRBench 62.8%）。

### 2-3. 構造保持型の変換は下流精度を上げる【実証】

**From PDF to RAG-Ready**（Applied Sciences 16(10) 5069、arXiv:2604.04948）

| パイプライン | 正答率 |
|---|---|
| 素のPDFLoader | 86.2% |
| 人手整形Markdown | 91.3% |
| **Docling + 階層分割 + 画像説明** | **94.1% ± 1.6%** |
| GraphRAG | 82%（標準RAGに敗北） |

**表依存の質問で、基本split対階層splitの差が33ポイント。** 最良の自動パイプラインが人手整形を上回った点も重要。

### 2-4. 文書構造に沿った分割が有効【実証】

- **Shaukat et al. 2026**（UltraDomain 6分野・36手法・5埋め込みモデル）: nDCG@5 で段落グループ0.459 対 固定文字数0.244。Precision@1 は24% 対 2-3%
- **HiChunk**（arXiv:2509.11552）: 階層分割 + Auto-Merge で Evidence Recall 74.06 → 81.03
- **OfficeQA Pro**: 素朴なチャンキング（表ヘッダがボディから切り離される）で**相対−27%**

### 2-5. チャンクへの文脈付与は効く【実証】

- **Anthropic Contextual Retrieval**: 各チャンクに50-100トークンの文脈を前置し、top-20失敗率 5.7% → 3.7%（**−35%**）、BM25併用で2.9%（−49%）、リランク追加で1.9%（−67%）
- **OfficeQA Pro contextual embeddings**（文書名・日付・ページ番号・セクション名を付加）: 標準ベクタ検索比**+21%**、ツール呼び出し−44%、コスト−44%
- **Late Chunking**（arXiv:2409.04701）: LLMコストなしで nDCG@10 +1.9pt（相対+3.63%）

### 2-6. 表の扱い【実証】

- **行単位チャンク＋各行へのヘッダ反復**が一貫して有効（3GPP仕様書、392文書・21,824表・専門家作成278問・16条件の統制実験）
- **要約は検索にだけ使い、生成には原文を渡す**（T²-RAGBench, EACL 2026。23,088三つ組）:

| 戦略 | Number Match |
|---|---|
| SumContext（要約で検索・原文で生成） | 39.5 |
| Base-RAG | 35.8 |
| **Summarization（要約で検索も生成も）** | **22.2（崩壊）** |

- **列は行より危険**: 50行×5列で正答率0.81、**5行×50列で0.43**（MMTU）
- **表サイズ効果は形式差より桁違いに大きい**: 最大−52pt（100行超で Gemini-2.5-flash 67.06% → 14.88%）
- **Markdownにはcolspan/rowspanが存在しない**ため結合セル・階層ヘッダを表現できない【構造的事実】

### 2-7. リランカーは強く支持される【実証】

**Beyond the Reranker**（arXiv:2606.28367、leave-one-outアブレーション）: リランカー除去で nDCG@10 が **0.644 → 0.034**。一方 RAPTOR / GraphRAG / rank fusion / CRAG は Holm-Bonferroni補正後に**いずれも有意差なし**。

### 2-8. 書式に対する感度は消えない【実証】

**FormatSpread**（ICLR 2024、arXiv:2310.11324。SuperNaturalInstructions 53タスク）

- 最大スプレッド **76 accuracy points**（LLaMA-2-13B）、GPT-3.5-Turbo で56.2pt、中央値7.5pt
- **`:` と `: ` の違いだけで78.3ポイント差**の事例
- **モデルサイズ増・few-shot増・instruction tuningのいずれでもスプレッドは消えない**
- **良い書式はモデル間で相関しない**

**→ 「正解の書式」を事前に決めることはできない。**

---

## 3. 通説が否定されたもの

| 通説 | 実証的状況 |
|---|---|
| Markdownが最良のLLM入力形式 | **否定的**。モデル世代依存（arXiv:2411.10541）。表形式では11形式中7位でJSONにも劣る【未査読ベンチ】 |
| semantic chunkingが優れる | **否定的**。4件以上の独立研究。実データでは固定長が同等以上（arXiv:2410.13070）。精度差1.65ptのために**計算時間が最大54,000倍**（GraphSeg 3.1時間 / LumberChunker 8.4時間 / DenseX 15.1時間 対 固定長1秒未満） |
| chunk size/overlapのチューニングは重要 | **限定的**。32トークン以上で nDCG@10 が数値的に区別不能（arXiv:2604.12047） |
| 取得件数を増やせば精度が上がる | **否定的**。逆U字（OP-RAG）。20文書設定で中央配置は closed-book を下回る（Lost in the Middle: 53.8% 対 56.1%） |
| GraphRAG / RAPTOR は効く | **否定的**。効果なし（2606.28367）、標準RAGに敗北（82% 対 94.1%） |
| 人間可読な整形はLLMにも良い | **否定的**。コード整形除去で Pass@1 維持のまま**トークン24.5%削減**（ICSE'26, arXiv:2508.13666） |
| 論理的な構造化は有利 | **反証あり**。Context Rot（Chroma, 18モデル）: **"structural coherence consistently hurts model performance"**。シャッフルしたhaystackのほうが成績が良い【未査読・企業レポート】 |
| llms.txt は有効 | **否定的**。個人提案でRFC/標準ではない。Ahrefs 137,000ドメイン調査で**97%が一度もリクエストされていない**。Googleは「サポートせず、予定もない」と明言 |
| 構造化コンテンツはAIに良い（構造化オーサリング業界） | **主張のみ。**測定フレームワークを伴う実証は見つからなかった。ただし階層split・表構造保持については実証あり |

---

## 4. 誰も検証していないこと（空白領域）

**これが本プロジェクトの位置づけを決める。**

### 4-1. 投入前のコーパス品質を測る枠組みが存在しない【重要】

RAG評価フレームワーク10種（RAGAS / ARES / TruLens / DeepEval / RAGChecker / CRUD-RAG / RGB / TREC RAG / Databricks / LlamaIndex）を調査した結果、**すべてがクエリ（多くは加えて生成回答や正解）を必須入力とし、コーパス単独で計算できる指標はゼロ**であった。

一方、**事前学習コーパス側にはスコアリング手法が確立している**（QuRating の4質、FineWeb-Edu の0〜5教育スコア＋回帰モデル蒸留、ASE 2024 の18特性）。**この非対称性が空白の正体。**

Qu et al. も論文の限界として「チャンク品質のground truthが存在しない」と明記している。

### 4-2. 他に未解明の論点

| # | 空白 |
|---|---|
| 1 | **Markdown記号そのものの効果を切り出した統制実験**（同一チャンク内容から `##` `|` だけを除去した比較）が存在しない |
| 2 | **「別紙参照」「上記の通り」のような文書をまたぐ参照の解決**を扱った研究が存在しない。既存の共参照解決研究はすべて同一文書内の代名詞が対象 |
| 3 | **「パース品質 vs チャンキング vs 埋め込みモデル」を同一実験で分散分解した研究**が存在しない |
| 4 | **「OCR誤り率X%でRAG精度がYpt落ちる」という一般化可能な曲線**が存在しない |
| 5 | **日本語文書に特化した査読付きベンチマーク**が見つからない |
| 6 | 表を自然言語文に変換して埋め込む戦略のRAG検索精度を測った研究がない |

### 4-3. 日本語での一次証拠（数少ない例）

**medRxiv 2026-01-02**（Fukataki, Hayashi, Kitayama, Ito。日本語治験実施計画書マニュアル約600セグメント）: **上位検索結果ですら品質基準を満たすのは5件に1件未満。1セクションを構造化し直しただけで満点になった。**論文自身が「入力文書品質のチャンクレベル定量評価は十分に検討されていない」とギャップを明示。【abstract経由・本文403で未取得】

---

## 5. 流用できる既存の枠組み

**自前で分類軸を作る前に、これらを使う。**

### 5-1. ICIS 2025 — RAGのデータ品質次元【最も近い】

**Data Quality Challenges in Retrieval-Augmented Generation**（Müller, Holstein, Bause, Satzger, Kühl、ICIS 2025、arXiv:2510.00552）

Wang & Strong (1996) のDQ4次元をRAGの4工程にマッピングし、**`Accountability` を第5次元として追加**。専門家16名の半構造化インタビュー＋Gioia法で26のDQ課題を同定。

**4工程**: `Data extraction` → `Data transformation` → `Prompt & Search` → `Generation`

**Data extraction 段階の次元**:

| 次元 | 下位テーマ |
|---|---|
| `Intrinsic DQ` | Objectivity, Accuracy |
| `Contextual DQ` | Uniqueness, Coverage, Timeliness and Versioning, Relevance |
| `Representational DQ` | Domain Knowledge, Representational Consistency |
| `Accessibility DQ` | Integration, Accessibility |
| **`Accountability DQ`（新規）** | Ownership, Compliance |

著者の結論: **「新しい次元はRAGの初期工程に集中しており、front-loaded な品質管理戦略が必要」**——本プロジェクトの狙いと一致する。

⚠️ ただし**これは定性的タクソノミーであり、スコアリング手法・閾値・妥当性検証を伴わない。**「次元」はあるが「測る道具」はない。

### 5-2. OHRBench — ノイズの2分類【シンプルで実用的】

| 分類 | 意味 | 重要な知見 |
|---|---|---|
| `Semantic Noise` | 予測誤り（文字認識ミス）に起因 | **誰も耐性を持たない。**モデルが強くなっても解決しない |
| `Formatting Noise` | 文書要素表現の不統一に起因 | **モデルが強いほど耐性が上がる**（大型LLMで7%低下に留まる） |

**→ 書式を整えることの価値はモデル進化とともに逓減するが、内容の正確性の価値は逓減しない。**投資判断に直結する非対称性。

### 5-3. その他

| 用途 | 枠組み |
|---|---|
| 一般データ品質 | Wang & Strong (1996) 4カテゴリ / ISO/IEC 25012:2008 |
| スコアリング手法の前例 | QuRating（4質のペア比較）、FineWeb-Edu（LLM-as-judge 0〜5＋回帰蒸留） |
| 実務者が重視する品質特性 | ASE 2024 の18特性・4カテゴリ（Reliability 4.73 / Relevance 4.70 / Accuracy 4.65 が上位。**重複除去3.70・鮮度3.53は低評価**） |

---

## 6. 引用してはいけない数値

**一次資料で確認できなかったもの。設計根拠に使わないこと。**

| 主張 | 出典 | 状態 |
|---|---|---|
| 「Markdownチャンキングで検索精度35%改善」「トークン20-30%削減」 | マーケティングブログ | 原データなし |
| 「Docling 表抽出精度 97.9%」 | ブログ | Docling Technical Report本文に記載なし |
| 「LlamaParse 92% F1 / Docling 88% / MarkItDown 82%」 | 個人ブログ | 一次データなし |
| 「Adobe 2025調査: 業務PDFの38%にスキャンページ」 | ベンダーブログ | Adobe原調査に到達不能 |
| 「典型的RAGで1〜5%の文書が抽出テキストゼロ」 | pdfmux | 未検証 |
| 「TQA-BenchでMarkdownが優位」 | 検索結果 | abstractに該当記述なし |
| 「OCR誤り率5%から有意な影響」（Bazzo et al. 2020） | DZone経由 | 原典未取得 |
| 「MDPI Bioengineering 2025: adaptive 87% vs fixed 13%」 | 二次ブログ | 他の全研究と整合せず |
| 「Vectara NAACL 2025 チャンキング研究」 | 二次ブログ | 論文本体を特定できず |

### 利益相反のあるベンチマーク

| ベンチマーク | 作成者 | 1位 |
|---|---|---|
| ParseBench | LlamaIndex | LlamaParse |
| OfficeQA Pro | Databricks | ai_parse_document |
| The Hidden Ceiling | mixedbread | mixedbread Vector Store |

※ ただし OfficeQA Pro の「パーサ選択で22pt動く」という**分散の大きさ自体**は、どれが1位かと独立に成立する。

---

## 7. 本プロジェクトへの含意

### 7-1. 投資の優先順位【証拠に基づく】

1. **構造保持型の抽出**（表・読み順・階層の保持）— ColPali +15.2pt、パーサ選択22pt
2. **階層認識チャンキング＋メタデータ付与** — 表依存質問で33pt、contextual embeddings +21%
3. ハイブリッド検索
4. 埋め込みモデル選定 — +0.6pt
5. リランカー — （スコープ外だが効果は大）

### 7-2. 設計方針の修正点

| 旧方針（v0.1） | 修正後 | 根拠 |
|---|---|---|
| Markdownは「AIが読みやすい」から採用 | **消去法の最大公約数**として採用。優位性を主張しない | §1-2 |
| 中核は診断（採点） | **中核は抽出品質と構造保持**。診断はその効果と限界を示す添え物 | §1-1 |
| オーバーラップ既定80トークン | **文書種別で切り替え**。表を含むなら25%、含まないなら極小 | §3 と表の項が逆の結論 |
| 独自の6観点を立てる | **ICIS 2025 の次元 + OHRBench の2分類を土台にする** | §5 |
| 表はMarkdownで出力 | **結合セル・階層ヘッダがあるならHTML/LaTeX**（Markdownは構造的に表現不可） | §2-6 |

### 7-3. 本プロジェクトの位置づけ

```
既存OSS（MarkItDown / Docling / Unstructured / MinerU）
        │  多形式 → テキスト・Markdown化
        ▼
┌────────────────────────────────────┐
│ 空白領域（§4で確認済み）            │
│ ・投入前のコーパス品質の測定        │  ← AI2DocFrendry
│ ・文書をまたぐ参照の解決            │
│ ・日本語ビジネス文書への適用        │
└────────────────────────────────────┘
        ▼
既存フレームワーク（LangChain / LlamaIndex / RAGAS）
```

**「変換エンジンを自作しない」という v0.1 の判断は維持する。**ただし理由が変わった。当初は「車輪の再発明だから」だったが、実際には**パーサ選択が22ポイント動かす最重要要素**であり、自作すれば確実に既存OSSに劣るため。

---

## 8. 未完了の調査

| 項目 | 状態 |
|---|---|
| 形式比較の統制実験（Markdown / XML / JSON / プレーン） | **完了**（§1-3, §1-4） |
| arXiv:2510.13191 Figure 2 の全条件の数値 | 未確認。§1-3 の −70.8pt の根拠なので本文確認を推奨 |
| 2026年投稿分（2601〜2607番台）の査読状況 | すべて未確認。preprintの可能性 |
| Gao et al. RAGサーベイ（arXiv:2312.10997）のタクソノミー逐語 | 未確認（担当エージェントが検索予算上限に到達） |
| Zhao et al. "RAG and Beyond"（arXiv:2409.14924） | 存在確認のみ、内容未確認 |
| Searching for Best Practices in RAG（EMNLP 2024）の効果量 | abstract のみ確認、数値は未検証 |

---

## 9. 主要出典

**前処理の支配性**
- ColPali (arXiv:2407.01449, ICLR 2025) — https://arxiv.org/abs/2407.01449
- OfficeQA Pro (arXiv:2603.08655, Databricks) — https://arxiv.org/abs/2603.08655
- From PDF to RAG-Ready (arXiv:2604.04948, Applied Sciences 2026) — https://arxiv.org/abs/2604.04948

**OCR・パース品質**
- OCR Hinders RAG / OHRBench (arXiv:2412.02592, ICCV 2025) — https://arxiv.org/abs/2412.02592
- InduOCRBench (arXiv:2605.00911, 2026) — https://arxiv.org/abs/2605.00911
- Lost in OCR Translation? (arXiv:2505.05666, LANL 2025) — https://arxiv.org/abs/2505.05666
- OmniDocBench (arXiv:2412.07626, CVPR 2025) — https://arxiv.org/abs/2412.07626
- Semantic Integrity Failures (arXiv:2606.15020, 2026) — https://arxiv.org/abs/2606.15020

**チャンク戦略**
- Is Semantic Chunking Worth the Computational Cost? (arXiv:2410.13070, NAACL 2025 Findings) — https://arxiv.org/abs/2410.13070
- HiChunk (arXiv:2509.11552) — https://arxiv.org/abs/2509.11552
- Late Chunking (arXiv:2409.04701) — https://arxiv.org/abs/2409.04701
- Contextual Retrieval (Anthropic, 2024) — https://www.anthropic.com/engineering/contextual-retrieval
- Beyond the Reranker (arXiv:2606.28367, 2026) — https://arxiv.org/html/2606.28367v1

**書式感度**
- FormatSpread (arXiv:2310.11324, ICLR 2024) — https://arxiv.org/abs/2310.11324
- Does Prompt Formatting Have Any Impact on LLM Performance? (arXiv:2411.10541) — https://arxiv.org/abs/2411.10541
- Lost in the Middle (arXiv:2307.03172, TACL 2024) — https://arxiv.org/abs/2307.03172
- Context Rot (Chroma, 2025) — https://www.trychroma.com/research/context-rot
- The Hidden Cost of Readability (arXiv:2508.13666, ICSE'26) — https://arxiv.org/abs/2508.13666

**枠組み**
- Data Quality Challenges in RAG (arXiv:2510.00552, ICIS 2025) — https://arxiv.org/abs/2510.00552
- QuRating (arXiv:2402.09739, ICML 2024) — https://arxiv.org/abs/2402.09739
- FineWeb (arXiv:2406.17557) — https://arxiv.org/abs/2406.17557
- Wang & Strong (1996), JMIS — Beyond Accuracy: What Data Quality Means to Data Consumers
- ISO/IEC 25012:2008 — https://iso25000.com/index.php/en/iso-25000-standards/iso-25012

**表**
- T²-RAGBench (arXiv:2506.12071, EACL 2026) — https://arxiv.org/abs/2506.12071
- MMTU (arXiv:2506.05587) — https://arxiv.org/html/2506.05587v2
- TableEval (arXiv:2506.03949) — https://arxiv.org/html/2506.03949v1
- 3GPP表表現評価 (arXiv:2408.17008) — https://arxiv.org/abs/2408.17008

**ベンダーガイダンス**
- Anthropic Prompting best practices — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags
- OpenAI GPT-4.1 Prompting Guide — https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
- Google Gemini Prompting strategies — https://ai.google.dev/gemini-api/docs/prompting-strategies

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 0.1 | 2026-07-21 | 初版。**推測ベース**。「Markdownは構造化されているので読みやすい」等、根拠のない記述を含む |
| 1.0 | 2026-07-21 | 6テーマの並行調査（271回のツール実行）に基づき全面書き換え。実証・主張・未確認を分離。旧版の主張の多くが否定された |
