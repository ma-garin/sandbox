# P3 セキュリティ検証（取得層・Web の入口）

- 実施日: 2026-09-25 / 環境: macOS・Node v25.6.0 / ネットワーク接続なし（git の送信先は 127.0.0.1 の受け口）
- 方法: 細工した .zip（Python zipfile とバイト書き換えで作成）・node スクリプト・`createWebServer` に対する HTTP 要求で再現。再現に使ったスクリプトは作業用フォルダに置き、リポジトリには入れていない
- 判定: 再現できたものだけを指摘に載せた。推測は末尾の「未検証」に分けた

## 指摘（ISTQB の severity）

| # | Severity | 箇所 | 再現手順 | 期待 | 実際 | 直し方の方針 |
|---|---|---|---|---|---|---|
| 1 | High | src/ingest/exclude.ts:24-44（globBody）, :63, :102（loadExcluder） | `createExcluder('*a'.repeat(8)+'*b\n', []).check('a'.repeat(40)+'.js', false)`。`.gitignore` にこの行と `a`×63 の名前のファイルを入れた .zip を `ingest({kind:'zip'})` に渡す | 除外判定がファイルごとに数 ms で終わる | `*` 8 個・名前 43 文字で 9.0 秒。`*` 12 個・名前 63 文字の .zip は 5 分を超えても終わらず強制終了した。`**/`×10 と深さ 25 のパスでも 7.4 秒。.gitignore は解析対象（アップロード .zip・GitHub）が持ち込めるため、Web サーバのイベントループが止まり全利用者が待たされる（REDoS） | glob を正規表現にせず、区切りごとの線形照合（minimatch 相当の DP）にする。または連続する `*`・`**/` を 1 つに畳み、`*` の数とパターン長に上限を設ける。.gitignore の行数・長さにも上限 |
| 2 | Medium | src/web/server.ts:174（busy の判定）, :161（busy=true） | 本文の送信を 300 ms 遅らせた POST /api/run を 3 本同時に送る | 2 本目以降は 409 | 3 本とも 202 で、runner が 3 回呼ばれた。busy を立てるのが本文を読んだ後のため、同時実行の排他が効かない。最初の 1 本が終わると他が走っている間でも busy=false に戻る | 判定と同時に `busy=true` にして（本文を読む前）、失敗経路すべてで戻す。または実行中の件数で数える |
| 3 | Medium | src/ingest/zip.ts:77（brokenError に fs のエラー文をそのまま連結）, src/web/server.ts:73・202（InputError の文をそのまま返す） | 同じ名前の項目が 2 つある .zip（`a.txt`×2）、`a` のあとに `a/b.txt`、名前が `.` の項目のどれかを CLI の `--zip` または Web でアップロード | 利用者向けの文に絶対パスを出さない（AGENTS.md の利用者向け文言規約） | CLI の標準エラーと Web の SSE の failure に `EEXIST: file already exists, open '/var/folders/…/T/spec2doc-zip-XXXX/root/a.txt'` が出る | mapYauzlError で fs のエラー（`code` を持つもの）は固定文にし、詳細はサーバ側のログにだけ書く |
| 4 | Medium | src/ingest/zip.ts:146（`name.endsWith('/')` を正規化の前の名前で見る） | 項目名が `src\`（ディレクトリ）と `src\a.js` の .zip（一部の Windows の圧縮ツールが作る形）。ディレクトリ属性あり・なしの両方 | `src/a.js` が展開される（REQ-F-041） | `src\` を 0 バイトのファイル `src` として書き、次の項目の mkdir が EEXIST になって .zip 全体が失敗する（絶対パス付きの文を表示・#3） | 判定を正規化後の `norm.endsWith('/')` にする。重複名・ファイルとディレクトリの衝突は、その項目だけ D08 に拒否で載せて残りを展開する |
| 5 | Medium | src/ingest/github.ts:51（トークンを `-c http.extraHeader=…` で引数に入れる） | `git -c 'http.extraHeader=Authorization: Bearer ghp_SECRET123' clone -- http://127.0.0.1:18767/a/b.git d` を起動し、実行中に `ps -Ao user,args` | トークンがプロセスの引数に現れない（REQ-N-008） | `ps` の出力にトークンがそのまま出た。同じ端末の他の利用者・他のプロセスから読める | 引数でなく環境変数 `GIT_CONFIG_COUNT=1`・`GIT_CONFIG_KEY_0=http.https://github.com/.extraHeader`・`GIT_CONFIG_VALUE_0=…` で渡す（キーを github.com に限定すると他ホストへの送信も防げる） |
| 6 | Medium | src/ingest/index.ts:55・74（extractZip に上限を渡さない）, src/ingest/zip.ts:121・199（ヒント文） | `grep -rn "maxTotalBytes\|maxFiles\|ZipLimits\|extractZip(" src` で zip.ts 以外の呼び出しを探す | 上限を設定で変えられる（REQ-N-017・018「設定で変更可」） | 呼び出しは index.ts:74 の 1 か所で、上限を渡していない。CLI・Web・環境変数のどれからも変えられないのに、エラーのヒントは「設定で上限を引き上げて再実行」と案内する | CLI の引数か環境変数から ZipLimits を渡す。用意しないなら REQ を改め、ヒント文から「設定で引き上げ」を外す |
| 7 | Low | src/ingest/zip.ts:117（entryCount を数える） | ディレクトリ 1 件＋ファイル 2 件の .zip を `extractZip(…, {maxFiles: 2})` に渡す | ファイル 2 件は上限内なので展開する（REQ-N-018 はファイル数） | 「上限 2 件を超えています（3 件）」で拒否。ディレクトリも件数に入る | ファイル数で数えるか、REQ の表記を「項目数」に改める |
| 8 | Low | src/ingest/zip.ts:198 | サイズ上限の失敗文をコードと上限を小さくした実行で確認 | 「展開後のサイズが上限 1GB を超えました」の趣旨（REQ-N-017） | 「上限 1073741824 バイト」とバイト数で出る | 単位を GB・MB に丸めて表示する |
| 9 | Low | src/ingest/index.ts:66・src/ingest/github.ts:76・src/web/server.ts:189（一時領域）。シグナルの処理なし | 大きい .zip の処理中に node を SIGTERM で止める（今回は #1 の再現中に強制終了） | 終了後に一時領域が残らない（REQ-F-040） | `$TMPDIR/spec2doc-zip-XXXX` が 1 件残った | SIGINT・SIGTERM で進行中の cleanup を呼ぶ。起動時に古い `spec2doc-*` を掃除する |
| 10 | Low | src/ingest/exclude.ts:19-21（`[` `]` を文字のまま扱う） | `.gitignore` に `*.[oa]` を書き、`x.o` を判定 | 除外する（gitignore の文字クラス） | 除外されない（null） | globBody で `[...]` を文字クラスとして変換する |

## 攻撃が通らなかったもの（再現して確認）

| 観点 | 確かめたこと | 結果 |
|---|---|---|
| zip slip | `..\evil.txt`・`foo\..\..\evil2.txt`・`C:\evil3`・`\\srv\share\x`・名前に NUL（バイト書き換え）・`../` | すべてその項目だけ「展開拒否（パス走査）」になり、展開先の外にファイルは 0 件 |
| Unicode の見かけの `..` | `．．/x.txt`（全角）・`‥/y.txt` | ただの名前として中に展開。外には出ない |
| シンボリックリンク | Unix 属性 S_IFLNK の項目 `link → /etc/passwd` | 拒否され D08 行きの一覧に載る |
| 宣言サイズの偽装 | 中身 100,000 バイト・宣言 10 バイト | yauzl の検査で止まり InputError。一時領域の残り 0 |
| 壊れた .zip | 中央ディレクトリの無いファイル | InputError。一時領域の残り 0 |
| 失敗時の片付け | 上の失敗の全件で `$TMPDIR/spec2doc-*` の件数を前後比較 | 増えない（強制終了の場合を除く・#9） |
| folder の外へのリンク | フォルダ内の外部を指すディレクトリリンク・ファイルリンク | 辿らず「シンボリックリンク（辿らない）」で除外 |
| 否定パターンで既定除外を戻す | .gitignore の `!node_modules`・`!dist/`、利用者指定の `!node_modules/**`・`!**/*.min.js` | 既定の除外が優先され戻らない |
| Host・Origin | Host `evil.com`・`127.0.0.1:<port>.evil.com`、Origin `null`・`http://127.0.0.1:<port>.evil.com`・`https://127.0.0.1:<port>` | すべて 403 |
| ダウンロードの走査 | `..%2f`・`%2e%2e`・`%252e%252e%252f`・`..%5c`・`%00`・不正な % 符号・大文字拡張子・view での .md | すべて 400/404。範囲外のファイルは読めない |
| multipart | Content-Length での超過・chunked での超過・終端なし・拡張子が .zip でない | 413・413・400・400。応答は届く |
| 想定外の例外 | runner が絶対パス入りの Error を投げる | 応答は固定文。詳細はサーバのログだけ |
| 待ち受け | `PORT=18766 node src/web/server.ts` を `lsof` で確認 | `127.0.0.1:18766` のみ |
| GitHub の URL | 別ホスト・`../`・`?`・`#`・改行・userinfo・`file://`・大文字ホスト | すべて拒否。`-b` 等の名前は `--` の後ろなので引数にならない |
| ref の注入 | `--upload-pack=…`・`-b`・`..`・`@{`・`~`・空白 | すべて拒否 |
| トークンの漏れ（エラー） | 失敗する git（引数入りの Error）を差し込んで fetchGithub を呼ぶ | エラー文・例外にトークンは含まれない。run-log の input は URL と ref だけ（src/core.ts:57-64） |
| 対象コードの実行 | `grep -rn "child_process\|spawn\|execFile\|vm\.\|new Function\|eval(" src` | git の呼び出し（github.ts）以外は 0 件。folder 入力には chmod をかけない |

## テストの確認（test/ingest-zip.test.ts）

- サイズ上限（L115）・件数上限（L128）・壊れた zip（L142）の 3 件は残っている。現在は 5 件（正常・危険な項目・サイズ・件数・壊れた zip）
- `src/`・`test/` は git の管理外（`git status` で `??`）のため、7 件から 5 件に減った履歴と、消えた 2 件の中身は確かめられない（未検証）
- #1〜#4・#7 に当たるテストは無い（重複名・`\` のディレクトリ・同時実行・.gitignore の REDoS・絶対パスを出さないこと）

## 未検証（再現していないもの）

- GitHub がリダイレクトした先が別ホストのとき、http.extraHeader のトークンがそこにも送られるか（ネットワーク接続なしのため）。#5 の直し方でホストを限定すれば論点ごと消える
- Shift_JIS 名の .zip（UTF-8 フラグなし）を latin1 で読む（zip.ts:98）ため、2 バイト目が 0x5C の文字（「表」など）が `/` に化けて階層が分かれる可能性
- 5 万件規模・数 GB 規模のフォルダ走査の時間とメモリ。Web の本文を 100 MB まで全量メモリに読み、Buffer を 2〜3 回複写する（multipart.ts:43・65）ことによるピークメモリ
- 利用者のグローバル設定にある git-lfs などのフィルタが clone 時に動くこと（解析対象のコードではないが、外部プロセスは起動する）
