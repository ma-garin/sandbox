"""ジェネレータ系エンジン B: 負荷テスト・OSSリスク・静的解析・SAPシナリオ

load_test_gen       : 負荷テストシナリオ + Locustスクリプト生成
oss_risk_calc       : OSSリスク評価・SBOM生成
static_code_analysis: ソースコード静的解析（パターンマッチベース）
sap_scenario_gen    : SAPテストシナリオ生成（Tコード・認可オブジェクト付き）

すべて純粋関数。AIなし・外部依存なし・完全決定的。
将来のAI換装も同一シグネチャで対応（Strategyパターン）。
"""
from __future__ import annotations

import re

# ═══════════════════════════════════════════════════════════════
# 1. 負荷テストシナリオ生成（load_test_gen）
# ═══════════════════════════════════════════════════════════════

_BOTTLENECK_CHECKS = [
    "CPUスパイク: テスト中のCPU使用率が80%を超えないか確認する",
    "メモリリーク: 耐久テスト中にメモリが線形増加していないか確認する",
    "DB接続プール: コネクション枯渇でタイムアウトが多発していないか確認する",
    "スレッドプール/イベントループ: キューが積み上がっていないか確認する",
    "GCポーズ: Java/Go/Node のGCによる応答時間スパイクを確認する",
    "外部APIレイテンシ: 外部依存のレスポンス時間が全体を律速していないか確認する",
    "ネットワーク帯域: スループット上限がNIC/ロードバランサーに達していないか確認する",
    "ディスクI/O: ログ書き込みやDBページングがボトルネックになっていないか確認する",
]

_LOCUST_TEMPLATE_WEB = """\
# -*- coding: utf-8 -*-
\"\"\"Locust 負荷テストスクリプト（{system_type} / {protocol}）\"\"\"
from locust import HttpUser, task, between
from locust.runners import MasterRunner

class {class_name}(HttpUser):
    wait_time = between(1, 3)
    host = "https://your-target-host.example.com"

    def on_start(self):
        \"\"\"セッション開始時にログイン。\"\"\"
        self.client.post("/api/auth/login", json={{
            "email": "test@example.com",
            "password": "TestPass123!"
        }}, catch_response=True)

    @task(5)
    def browse_home(self):
        with self.client.get("/", catch_response=True) as r:
            if r.elapsed.total_seconds() * 1000 > {sla_resp_ms}:
                r.failure(f"SLA違反: {{r.elapsed.total_seconds()*1000:.0f}}ms > {sla_resp_ms}ms")

    @task(3)
    def search(self):
        with self.client.get("/search?q=test", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"HTTP {{r.status_code}}")

    @task(2)
    def api_data(self):
        with self.client.get("/api/data", catch_response=True) as r:
            if r.status_code not in (200, 204):
                r.failure(f"HTTP {{r.status_code}}")

    @task(1)
    def post_data(self):
        with self.client.post("/api/items", json={{
            "name": "テストアイテム",
            "value": 42
        }}, catch_response=True) as r:
            if r.status_code not in (200, 201):
                r.failure(f"HTTP {{r.status_code}}")

# 実行: locust -f locustfile.py --headless -u {concurrent_users} -r 10 --run-time {duration_min}m
# SLA: 応答時間(95%ile) < {sla_resp_ms}ms, スループット >= {sla_tps} TPS
"""

_LOCUST_TEMPLATE_API = """\
# -*- coding: utf-8 -*-
\"\"\"Locust 負荷テストスクリプト（REST API）\"\"\"
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(0.1, 0.5)
    host = "https://api.your-service.example.com"
    token = ""

    def on_start(self):
        r = self.client.post("/auth/token", json={{
            "client_id": "test_client",
            "client_secret": "test_secret"
        }})
        if r.ok:
            self.token = r.json().get("access_token", "")
        self.headers = {{"Authorization": f"Bearer {{self.token}}"}}

    @task(6)
    def get_list(self):
        with self.client.get("/v1/resources",
                             headers=self.headers,
                             catch_response=True) as r:
            if r.elapsed.total_seconds() * 1000 > {sla_resp_ms}:
                r.failure(f"SLA違反: {{r.elapsed.total_seconds()*1000:.0f}}ms")

    @task(3)
    def get_detail(self):
        self.client.get("/v1/resources/1", headers=self.headers)

    @task(2)
    def create(self):
        with self.client.post("/v1/resources",
                              json={{"name": "test", "value": 42}},
                              headers=self.headers,
                              catch_response=True) as r:
            if r.status_code not in (200, 201):
                r.failure(f"HTTP {{r.status_code}}")

    @task(1)
    def health(self):
        self.client.get("/health")

# 実行: locust -f locustfile.py --headless -u {concurrent_users} -r 20 --run-time {duration_min}m
"""

_LOCUST_TEMPLATE_BATCH = """\
# -*- coding: utf-8 -*-
\"\"\"Locust 負荷テストスクリプト（バッチ処理トリガー）\"\"\"
from locust import HttpUser, task, between

class BatchTriggerUser(HttpUser):
    wait_time = between(5, 10)
    host = "https://batch.your-service.example.com"

    @task
    def trigger_batch(self):
        with self.client.post("/api/batch/jobs",
                              json={{"type": "data_export", "priority": "normal"}},
                              catch_response=True) as r:
            if r.status_code == 202:  # Accepted
                job_id = r.json().get("job_id")
                # ポーリングでジョブ完了を確認
                for _ in range(10):
                    status_r = self.client.get(f"/api/batch/jobs/{{job_id}}")
                    if status_r.json().get("status") == "completed":
                        break
            elif r.status_code == 429:
                r.failure("スロットリング: ジョブキューが満杯")
            elif r.elapsed.total_seconds() * 1000 > {sla_resp_ms}:
                r.failure("SLA違反")

# 実行: locust -f locustfile.py --headless -u {concurrent_users} -r 5 --run-time {duration_min}m
"""

_LOCUST_TEMPLATE_STREAMING = """\
# -*- coding: utf-8 -*-
\"\"\"Locust 負荷テストスクリプト（ストリーミング）\"\"\"
import time
from locust import HttpUser, task, between

class StreamingUser(HttpUser):
    wait_time = between(1, 2)
    host = "https://stream.your-service.example.com"

    @task(3)
    def consume_stream(self):
        with self.client.get("/stream/events",
                             stream=True,
                             catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"HTTP {{r.status_code}}")
                return
            start = time.time()
            chunk_count = 0
            for chunk in r.iter_content(chunk_size=1024):
                chunk_count += 1
                if chunk_count >= 10:
                    break
            latency_ms = (time.time() - start) * 1000
            if latency_ms > {sla_resp_ms}:
                r.failure(f"初回レスポンスSLA違反: {{latency_ms:.0f}}ms")

    @task(1)
    def send_event(self):
        self.client.post("/stream/publish",
                         json={{"event": "user_action", "data": "test"}})

# 実行: locust -f locustfile.py --headless -u {concurrent_users} -r 10 --run-time {duration_min}m
"""

_LOCUST_BY_TYPE = {
    "web": _LOCUST_TEMPLATE_WEB,
    "api": _LOCUST_TEMPLATE_API,
    "batch": _LOCUST_TEMPLATE_BATCH,
    "streaming": _LOCUST_TEMPLATE_STREAMING,
}

_CLASS_NAMES = {
    "web": "WebUser", "api": "ApiUser",
    "batch": "BatchTriggerUser", "streaming": "StreamingUser",
}


def load_test_gen(system_type, concurrent_users, sla_resp_ms, sla_tps, duration_min, protocol):
    """負荷テストシナリオ + Locustスクリプトを生成する。"""
    st = system_type or "web"
    cu = int(concurrent_users) if str(concurrent_users).isdigit() else 100
    sla_ms = int(sla_resp_ms) if str(sla_resp_ms).isdigit() else 2000
    sla_t = int(sla_tps) if str(sla_tps).isdigit() else 50
    dur = int(duration_min) if str(duration_min).isdigit() else 30
    proto = protocol or "https"

    scenarios = [
        {
            "id": "LS-001",
            "name": "スモークテスト（動作確認）",
            "type": "スモーク",
            "users": 1,
            "ramp_up_min": 0,
            "duration_min": max(5, dur // 6),
            "target_tps": max(1, sla_t // 10),
            "acceptance_criteria": f"エラー率0%・応答時間 < {sla_ms}ms",
            "priority": "必須",
        },
        {
            "id": "LS-002",
            "name": f"負荷テスト（目標{cu}ユーザー）",
            "type": "負荷",
            "users": cu,
            "ramp_up_min": max(1, dur // 10),
            "duration_min": dur,
            "target_tps": sla_t,
            "acceptance_criteria": f"エラー率 < 1%・応答時間(95%ile) < {sla_ms}ms・スループット >= {sla_t}TPS",
            "priority": "必須",
        },
        {
            "id": "LS-003",
            "name": f"スパイクテスト（瞬間{cu*2}ユーザー）",
            "type": "スパイク",
            "users": cu * 2,
            "ramp_up_min": 1,
            "duration_min": max(10, dur // 3),
            "target_tps": sla_t * 2,
            "acceptance_criteria": f"システムがクラッシュしない・スパイク後に正常回復する",
            "priority": "必須",
        },
        {
            "id": "LS-004",
            "name": f"耐久テスト（{int(cu*0.7)}ユーザー × {dur*2}分）",
            "type": "耐久",
            "users": int(cu * 0.7),
            "ramp_up_min": max(2, dur // 5),
            "duration_min": dur * 2,
            "target_tps": int(sla_t * 0.7),
            "acceptance_criteria": f"メモリリーク・ファイルディスクリプタ枯渇なし・エラー率 < 0.1%",
            "priority": "推奨",
        },
    ]

    sla_table = [
        {"metric": "応答時間(95th%ile)", "target": f"< {sla_ms}ms",
         "method": "Locust/Prometheus で計測"},
        {"metric": "スループット", "target": f">= {sla_t} TPS",
         "method": "Locust 集計値（req/s）"},
        {"metric": "エラー率", "target": "< 1%",
         "method": "Locust エラー数 / 総リクエスト数"},
        {"metric": "CPU使用率(サーバー)", "target": "< 80%",
         "method": "CloudWatch / Grafana でテスト中を監視"},
        {"metric": "メモリ使用量", "target": "線形増加なし",
         "method": "テスト前後・中間の3時点で比較"},
    ]

    template = _LOCUST_BY_TYPE.get(st, _LOCUST_TEMPLATE_WEB)
    locust_script = template.format(
        system_type=st,
        protocol=proto,
        class_name=_CLASS_NAMES.get(st, "LoadUser"),
        concurrent_users=cu,
        sla_resp_ms=sla_ms,
        sla_tps=sla_t,
        duration_min=dur,
    )

    return {
        "scenarios": scenarios,
        "locust_script": locust_script,
        "sla_table": sla_table,
        "bottleneck_checklist": _BOTTLENECK_CHECKS,
        "total_scenarios": len(scenarios),
        "system_type": st,
        "concurrent_users": cu,
        "sla_resp_ms": sla_ms,
    }


# ═══════════════════════════════════════════════════════════════
# 2. OSSリスク評価（oss_risk_calc）
# ═══════════════════════════════════════════════════════════════

# 主要パッケージのライセンス知識ベース
_KNOWN_LICENSES = {
    # Python
    "django": ("BSD-3-Clause", "低"),
    "flask": ("BSD-3-Clause", "低"),
    "fastapi": ("MIT", "低"),
    "requests": ("Apache-2.0", "低"),
    "numpy": ("BSD-3-Clause", "低"),
    "pandas": ("BSD-3-Clause", "低"),
    "scipy": ("BSD-3-Clause", "低"),
    "sqlalchemy": ("MIT", "低"),
    "celery": ("BSD-3-Clause", "低"),
    "pytest": ("MIT", "低"),
    "pillow": ("HPND", "低"),
    "pydantic": ("MIT", "低"),
    "boto3": ("Apache-2.0", "低"),
    "cryptography": ("Apache-2.0 / BSD", "低"),
    "paramiko": ("LGPL-2.1", "中"),
    "mysqlclient": ("GPL-2.0", "高"),
    "mysql-connector-python": ("GPL-2.0", "高"),
    "pymysql": ("MIT", "低"),
    "psycopg2": ("LGPL-3.0", "中"),
    "gunicorn": ("MIT", "低"),
    "uvicorn": ("BSD-3-Clause", "低"),
    "aiohttp": ("Apache-2.0", "低"),
    "httpx": ("BSD-3-Clause", "低"),
    "jinja2": ("BSD-3-Clause", "低"),
    "click": ("BSD-3-Clause", "低"),
    "pyyaml": ("MIT", "低"),
    "toml": ("MIT", "低"),
    "attrs": ("MIT", "低"),
    "typing-extensions": ("PSF-2.0", "低"),
    "setuptools": ("MIT", "低"),
    "pip": ("MIT", "低"),
    "wheel": ("MIT", "低"),
    # Node.js
    "express": ("MIT", "低"),
    "react": ("MIT", "低"),
    "vue": ("MIT", "低"),
    "next": ("MIT", "低"),
    "lodash": ("MIT", "低"),
    "axios": ("MIT", "低"),
    "typescript": ("Apache-2.0", "低"),
    "webpack": ("MIT", "低"),
    "babel": ("MIT", "低"),
    "jest": ("MIT", "低"),
    "eslint": ("MIT", "低"),
    "moment": ("MIT", "低"),
    "dayjs": ("MIT", "低"),
    "uuid": ("MIT", "低"),
    "dotenv": ("BSD-2-Clause", "低"),
    "nodemon": ("MIT", "低"),
}

# GPLライセンスパターン（商用利用で高リスク）
_GPL_PATTERN = re.compile(r"GPL|AGPL|LGPL", re.IGNORECASE)
_MIT_APACHE_PATTERN = re.compile(r"MIT|Apache|BSD|ISC|WTFPL|Unlicense|CC0", re.IGNORECASE)

# バージョンが非常に古いことを示すパターン（メジャーバージョン0.x）
_OLD_VERSION_PATTERN = re.compile(r"^0\.\d+")


def _parse_python_deps(text):
    """requirements.txt 形式をパース。"""
    packages = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # name==1.0, name>=1.0, name<=1.0, name~=1.0, name
        m = re.match(r"^([A-Za-z0-9_\-\.]+)\s*[=><~!]+=?\s*([\w\.\*]+)?", line)
        if m:
            packages.append((m.group(1).lower(), m.group(2) or "不明"))
    return packages


def _parse_node_deps(text):
    """package.json の dependencies/devDependencies をパース。"""
    packages = []
    # シンプルな正規表現で "name": "version" を抽出
    for m in re.finditer(r'"([a-z@][a-z0-9_\-\./@]+)"\s*:\s*"([^"]+)"', text):
        name = m.group(1).lower()
        version = m.group(2).lstrip("^~>=<")
        packages.append((name, version))
    return packages


def _parse_java_deps(text):
    """Maven pom.xml / Gradle build.gradle から groupId:artifactId を抽出。"""
    packages = []
    # Maven: <artifactId>xxx</artifactId>
    for m in re.finditer(r"<artifactId>([^<]+)</artifactId>", text):
        packages.append((m.group(1).lower(), "不明"))
    # Gradle: implementation 'group:name:version'
    for m in re.finditer(r"['\"]([a-z][^:'\"\s]+):([^:'\"\s]+):([^'\"\s]+)['\"]", text):
        packages.append((m.group(2).lower(), m.group(3)))
    return list(dict.fromkeys(packages))  # deduplicate


def _assess_package(name, version):
    """パッケージのリスクを評価する。"""
    known = _KNOWN_LICENSES.get(name)
    if known:
        license_name, license_risk = known
    else:
        # GPLパターン検出（パッケージ名から推測）
        license_name = "不明"
        if "mysql" in name or "gpl" in name:
            license_risk = "高"
            license_name = "GPL（推定）"
        else:
            license_risk = "中"  # 不明は中リスク扱い

    # 保守リスク評価
    maintenance_risk = "低"
    if version and version != "不明":
        if _OLD_VERSION_PATTERN.match(str(version)):
            maintenance_risk = "高"
        elif version.startswith("1.") and name not in ("flask", "requests"):
            maintenance_risk = "中"

    # 特定の高リスクパッケージ
    high_risk_packages = {"mysql-connector-python", "mysqlclient", "cx-oracle"}
    if name in high_risk_packages:
        license_risk = "高"
        license_name = "GPL-2.0"

    # 総合リスク
    if license_risk == "高" and maintenance_risk in ("高", "中"):
        overall_risk = "重大"
    elif license_risk == "高" or (license_risk == "中" and maintenance_risk == "高"):
        overall_risk = "高"
    elif license_risk == "中" or maintenance_risk == "中":
        overall_risk = "中"
    else:
        overall_risk = "低"

    # 備考
    notes = ""
    if license_risk == "高":
        notes = "GPL系ライセンス: 商用利用時は法務確認が必要"
    elif license_name == "不明":
        notes = "ライセンス未確認: 手動でOSSライセンスを確認してください"
    elif maintenance_risk == "高":
        notes = "古いバージョン: 最新版へのアップデートを検討"

    return {
        "name": name,
        "version": version or "不明",
        "license": license_name,
        "license_risk": license_risk,
        "maintenance_risk": maintenance_risk,
        "overall_risk": overall_risk,
        "notes": notes,
    }


def oss_risk_calc(dependency_text, ecosystem):
    """OSSリスク評価・SBOM生成。"""
    eco = ecosystem or "python"

    if not dependency_text or not dependency_text.strip():
        # サンプルデータ
        dependency_text = (
            "django==4.2.7\nrequests==2.31.0\nnumpy>=1.24.0\n"
            "mysqlclient==2.1.1\nparamiko==3.3.1"
        )

    if eco == "python":
        raw_packages = _parse_python_deps(dependency_text)
    elif eco == "node":
        raw_packages = _parse_node_deps(dependency_text)
    elif eco == "java":
        raw_packages = _parse_java_deps(dependency_text)
    else:
        raw_packages = [(line.strip().lower(), "不明")
                        for line in dependency_text.splitlines()
                        if line.strip() and not line.startswith("#")]

    packages = [_assess_package(name, ver) for name, ver in raw_packages if name]

    # サマリー
    summary = {
        "total": len(packages),
        "critical": sum(1 for p in packages if p["overall_risk"] == "重大"),
        "high": sum(1 for p in packages if p["overall_risk"] == "高"),
        "medium": sum(1 for p in packages if p["overall_risk"] == "中"),
        "low": sum(1 for p in packages if p["overall_risk"] == "低"),
        "sbom_ready": all(p["license"] != "不明" for p in packages),
    }

    # SBOM (Software Bill of Materials)
    sbom = [{"name": p["name"], "version": p["version"],
              "license": p["license"], "risk": p["overall_risk"]}
            for p in packages]

    # 推奨事項
    recommendations = []
    if summary["critical"] > 0:
        recommendations.append(
            f"重大リスクパッケージが {summary['critical']}件あります。"
            "GPL系ライセンスは商用利用前に法務部門と確認してください。")
    if summary["high"] > 0:
        recommendations.append(
            f"高リスクパッケージが {summary['high']}件あります。"
            "代替パッケージへの移行を検討してください。")
    unknown_lic = [p["name"] for p in packages if p["license"] == "不明"]
    if unknown_lic:
        recommendations.append(
            f"ライセンス未確認パッケージが {len(unknown_lic)}件あります: "
            f"{', '.join(unknown_lic[:5])}。PyPI/npm で手動確認してください。")
    if not summary["sbom_ready"]:
        recommendations.append(
            "SBOM（部品表）が未完成です。全パッケージのライセンスを確認後、"
            "CycloneDX または SPDX 形式で出力することを推奨します。")

    return {
        "packages": packages,
        "summary": summary,
        "sbom": sbom,
        "recommendations": recommendations,
        "ecosystem": eco,
    }


# ═══════════════════════════════════════════════════════════════
# 3. ソースコード静的解析（static_code_analysis）
# ═══════════════════════════════════════════════════════════════

_PYTHON_RULES = [
    # (pattern, severity, category, message_template, fix)
    (r"\beval\s*\(", "Critical", "セキュリティ",
     "eval() の使用を検出: コードインジェクションの危険",
     "eval() を廃止し、ast.literal_eval() や専用パーサーを使用する"),
    (r"\bexec\s*\(", "Critical", "セキュリティ",
     "exec() の使用を検出: コードインジェクションの危険",
     "exec() を廃止し、処理を関数として定義する"),
    (r'password\s*=\s*["\'][^"\']+["\']', "Critical", "セキュリティ",
     "パスワードのハードコードを検出",
     "環境変数または Secrets Manager からパスワードを取得する"),
    (r'api[_-]?key\s*=\s*["\'][^"\']{8,}["\']', "Critical", "セキュリティ",
     "APIキーのハードコードを検出",
     "環境変数または Secrets Manager から APIキーを取得する"),
    (r"except\s*:", "Major", "コードスメル",
     "ベア except: を検出（全例外を捕捉）",
     "except Exception as e: のように捕捉する例外型を明示する"),
    (r"from\s+\w+\s+import\s+\*", "Major", "規約",
     "ワイルドカードインポート（from xxx import *）を検出",
     "必要なシンボルを明示的にインポートする"),
    (r"\bprint\s*\(", "Minor", "コードスメル",
     "print() の使用を検出（ロギング未使用）",
     "logging モジュールを使用する（logging.info/debug/error）"),
    (r"#\s*TODO|#\s*FIXME|#\s*HACK|#\s*XXX", "Info", "コードスメル",
     "TODO/FIXME/HACK コメントを検出",
     "Issue トラッカーに登録し、コードから削除する"),
    (r"0\.0\.0\.0|127\.0\.0\.1|localhost", "Minor", "セキュリティ",
     "ハードコードされたIPアドレスを検出",
     "設定ファイルまたは環境変数で管理する"),
]

_JS_RULES = [
    (r"\beval\s*\(", "Critical", "セキュリティ",
     "eval() の使用を検出: XSS・コードインジェクションの危険",
     "eval() を廃止し、JSON.parse() や専用処理に置換する"),
    (r"\.innerHTML\s*=", "Critical", "セキュリティ",
     "innerHTML への直接代入を検出: XSSの危険",
     "textContent を使用するか、DOMPurify でサニタイズしてから使用する"),
    (r"==\s*(?!>)[^=]", "Major", "規約",
     "緩い等値演算子（==）を検出",
     "厳格等値演算子（===）を使用する"),
    (r"\bvar\s+", "Minor", "規約",
     "var 宣言を検出（旧構文）",
     "const または let を使用する"),
    (r"\bconsole\.(log|warn|error)\s*\(", "Minor", "コードスメル",
     "console.log() の使用を検出（本番コードに不適切）",
     "本番コードでは削除するか、適切なロギングライブラリを使用する"),
    (r'password\s*[:=]\s*["\'][^"\']+["\']', "Critical", "セキュリティ",
     "パスワードのハードコードを検出",
     "環境変数または Secrets Manager から取得する"),
    (r"//\s*TODO|//\s*FIXME|//\s*HACK", "Info", "コードスメル",
     "TODO/FIXME コメントを検出",
     "Issue トラッカーに登録し、コードから削除する"),
    (r"setTimeout\s*\(\s*[\"']", "Major", "セキュリティ",
     "setTimeout に文字列を渡している（eval相当）",
     "setTimeout に文字列ではなく関数を渡す"),
]

_JAVA_RULES = [
    (r"System\.exit\s*\(", "Major", "コードスメル",
     "System.exit() の使用を検出（JVMを強制終了）",
     "例外をスローするか、終了フラグを使用する"),
    (r"catch\s*\(\s*Exception\s+\w+\s*\)\s*\{\s*\}", "Critical", "コードスメル",
     "空の catch ブロックを検出（例外のサイレント無視）",
     "例外をログ出力するか、適切に処理する"),
    (r"password\s*=\s*\"[^\"]+\"", "Critical", "セキュリティ",
     "パスワードのハードコードを検出",
     "環境変数またはVaultから取得する"),
    (r"\bString\s+\w+\s*=\s*[\"'][^\"']*[\"']\s*\+", "Minor", "複雑度",
     "ループ内のString連結を検出（パフォーマンス問題）",
     "StringBuilder または StringJoiner を使用する"),
    (r"//\s*TODO|//\s*FIXME|//\s*HACK", "Info", "コードスメル",
     "TODO/FIXME コメントを検出",
     "Issue トラッカーに登録し、コードから削除する"),
    (r"@SuppressWarnings\([\"']unchecked[\"']\)", "Minor", "コードスメル",
     "@SuppressWarnings(\"unchecked\") を検出（型安全性の無視）",
     "ジェネリクスを正しく使用して警告を根本解消する"),
]

_COMMON_RULES = [
    (r"password\s*[:=]\s*[\"'][^\"']{4,}[\"']", "Critical", "セキュリティ",
     "パスワードのハードコードを検出",
     "環境変数または Secrets Manager から取得する"),
    (r"secret[_-]?key\s*[:=]\s*[\"'][^\"']{8,}[\"']", "Critical", "セキュリティ",
     "シークレットキーのハードコードを検出",
     "環境変数または Secrets Manager から取得する"),
    (r"\b(?:192\.168|10\.\d+\.\d+)\.\d+\b", "Minor", "セキュリティ",
     "プライベートIPアドレスのハードコードを検出",
     "設定ファイルまたは環境変数で管理する"),
    (r"(?:TODO|FIXME|HACK|XXX)\b", "Info", "コードスメル",
     "TODO/FIXME/HACK マーカーを検出",
     "Issue トラッカーに登録し、コードから削除する"),
]

_RULES_BY_LANG = {
    "python": _PYTHON_RULES + _COMMON_RULES,
    "javascript": _JS_RULES + _COMMON_RULES,
    "typescript": _JS_RULES + _COMMON_RULES,
    "java": _JAVA_RULES + _COMMON_RULES,
    "other": _COMMON_RULES,
}

_SEV_DEDUCTIONS = {"Critical": 15, "Major": 7, "Minor": 2, "Info": 0}
_GRADE_THRESHOLDS = [(90, "A"), (75, "B"), (60, "C"), (40, "D"), (0, "F")]


def static_code_analysis(code_text, language):
    """ソースコード静的解析。パターンマッチで問題を検出する。"""
    lang = language or "python"
    if not code_text or not code_text.strip():
        code_text = (
            "def process(data):\n    password = 'hardcoded123'\n"
            "    try:\n        eval(data)\n    except:\n        pass\n"
            "    print('Done')\n"
        )

    lines = code_text.splitlines()
    n_lines = len(lines)

    # メトリクス
    comment_lines = sum(1 for l in lines if l.strip().startswith(("#", "//", "*", "/*")))
    comment_ratio = round(comment_lines / n_lines * 100, 1) if n_lines else 0

    # 複雑度推定（if/for/while/case/elif カウント）
    complexity_patterns = re.compile(
        r"\b(if|elif|else|for|while|case|catch|switch|&&|\|\|)\b")
    complexity = sum(len(complexity_patterns.findall(l)) for l in lines) + 1

    # 長い関数の検出（連続50行以上のインデント）
    long_functions = 0
    in_func = False
    func_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r"^\s*(def |function |public |private |protected )", line):
            if in_func and (i - func_start) > 50:
                long_functions += 1
            in_func = True
            func_start = i
    if in_func and (n_lines - func_start) > 50:
        long_functions += 1

    # ルール適用
    rules = _RULES_BY_LANG.get(lang, _COMMON_RULES)
    findings = []
    finding_id = 1
    for pattern, severity, category, message, fix in rules:
        for i, line in enumerate(lines, 1):
            if re.search(pattern, line, re.IGNORECASE):
                snippet = line.strip()[:80]
                findings.append({
                    "id": f"SA-{finding_id:03d}",
                    "severity": severity,
                    "line": i,
                    "category": category,
                    "message": message,
                    "code": snippet,
                    "fix": fix,
                })
                finding_id += 1

    # スコア計算
    score = 100
    for f in findings:
        score -= _SEV_DEDUCTIONS.get(f["severity"], 0)
    score = max(0, score)

    grade = "F"
    for threshold, g in _GRADE_THRESHOLDS:
        if score >= threshold:
            grade = g
            break

    summary = {"Critical": 0, "Major": 0, "Minor": 0, "Info": 0}
    for f in findings:
        summary[f["severity"]] = summary.get(f["severity"], 0) + 1

    return {
        "findings": findings,
        "metrics": {
            "lines": n_lines,
            "complexity_estimate": complexity,
            "comment_ratio": comment_ratio,
            "long_functions": long_functions,
        },
        "score": score,
        "grade": grade,
        "summary": summary,
        "language": lang,
    }


# ═══════════════════════════════════════════════════════════════
# 4. SAPテストシナリオ生成（sap_scenario_gen）
# ═══════════════════════════════════════════════════════════════

_SAP_MODULES = {
    "FI": "財務会計（FI）",
    "MM": "購買・在庫管理（MM）",
    "SD": "販売・流通（SD）",
    "PP": "生産計画（PP）",
    "HR": "人事管理（HR）",
    "PS": "プロジェクト管理（PS）",
    "WM": "倉庫管理（WM）",
    "basis": "SAP Basis（基盤）",
    "custom": "カスタム開発（Z/Y）",
}

_SCOPE_LABELS = {
    "happy_path": "ハッピーパス",
    "regression": "回帰テスト",
    "data_migration": "データ移行検証",
    "integration": "統合テスト",
    "performance": "性能テスト",
    "authorization": "認可テスト",
}

# FIシナリオテンプレート
_FI_SCENARIOS = [
    {
        "title": "総勘定元帳転記 (F-02)",
        "t_code": "F-02",
        "scope_type": "ハッピーパス",
        "precondition": "会社コードが有効・勘定科目が開設済み・会計期間がオープン",
        "steps": [
            {"action": "F-02を入力してトランザクション起動", "expected": "総勘定元帳: 転記画面が表示される", "t_code": "F-02"},
            {"action": "会社コード・転記日付・伝票タイプを入力", "expected": "入力フィールドが活性化", "t_code": "F-02"},
            {"action": "借方勘定科目・金額を入力", "expected": "借方行が追加される", "t_code": "F-02"},
            {"action": "貸方勘定科目・金額を入力", "expected": "貸借差額が0になる", "t_code": "F-02"},
            {"action": "転記ボタンをクリック", "expected": "伝票番号が採番され転記完了メッセージが表示される", "t_code": "F-02"},
            {"action": "FBL3Nで転記内容を照会", "expected": "転記した伝票が元帳に反映されている", "t_code": "FBL3N"},
        ],
        "test_data": "会社コード: 1000, 伝票タイプ: SA, 借方勘定: 100000, 金額: 1,000,000JPY",
        "authorization": "F_BKPF_BUK（転記権限・会社コード）",
        "priority": "High",
    },
    {
        "title": "顧客入金処理 (F-28)",
        "t_code": "F-28",
        "scope_type": "ハッピーパス",
        "precondition": "顧客マスタが存在・未決済の売掛金残高がある・銀行口座が設定済み",
        "steps": [
            {"action": "F-28を起動し入金データ入力画面を表示", "expected": "入金: 転記画面が起動する", "t_code": "F-28"},
            {"action": "会社コード・転記日付・入金金額・銀行口座を入力", "expected": "入力値が反映される", "t_code": "F-28"},
            {"action": "顧客番号を入力し未決済明細を呼び出す", "expected": "未決済の請求書一覧が表示される", "t_code": "F-28"},
            {"action": "相殺する請求書にチェックを付け入金と照合", "expected": "差額（残高）が0になる", "t_code": "F-28"},
            {"action": "転記を実行", "expected": "入金伝票番号が採番・売掛残高がクリアされる", "t_code": "F-28"},
        ],
        "test_data": "顧客コード: C-10001, 入金額: 500,000JPY, 銀行口座: MUFG-0001",
        "authorization": "F_BKPF_BUK, F_KNA1_AEN（顧客マスタ表示）",
        "priority": "High",
    },
    {
        "title": "仕入先請求書照合 (FB60)",
        "t_code": "FB60",
        "scope_type": "ハッピーパス",
        "precondition": "仕入先マスタ存在・発注書/検収伝票が転記済み",
        "steps": [
            {"action": "FB60を起動", "expected": "仕入先請求書入力画面が表示される", "t_code": "FB60"},
            {"action": "仕入先コード・請求日・請求金額を入力", "expected": "照合チェックが起動する", "t_code": "FB60"},
            {"action": "発注書番号を入力し明細を呼び出す", "expected": "発注明細が表示される", "t_code": "FB60"},
            {"action": "金額・数量が一致することを確認", "expected": "照合ステータスが「照合OK」になる", "t_code": "FB60"},
            {"action": "転記を実行", "expected": "請求伝票番号が採番・買掛金が計上される", "t_code": "FB60"},
        ],
        "test_data": "仕入先コード: V-20001, 請求金額: 3,000,000JPY（税込）",
        "authorization": "F_BKPF_BUK, F_LFA1_AEN（仕入先マスタ照会）",
        "priority": "High",
    },
    {
        "title": "支払い自動実行 (F110)",
        "t_code": "F110",
        "scope_type": "ハッピーパス",
        "precondition": "未払い請求書が存在・支払い条件・銀行連携設定済み",
        "steps": [
            {"action": "F110を起動しパラメータを設定", "expected": "支払い実行パラメータ画面が表示", "t_code": "F110"},
            {"action": "支払い実行日・決済方法・会社コードを指定", "expected": "パラメータが保存される", "t_code": "F110"},
            {"action": "提案実行（F8）", "expected": "支払い対象の請求書一覧が作成される", "t_code": "F110"},
            {"action": "提案リストを確認・承認", "expected": "承認済み提案が表示される", "t_code": "F110"},
            {"action": "支払い実行（F8）", "expected": "支払い伝票が転記・銀行振込データが生成される", "t_code": "F110"},
        ],
        "test_data": "支払い実行日: 月末, 決済方法: 電信振込（JPY）",
        "authorization": "F_BKPF_BUK, F_FAGL_L04（支払い実行）",
        "priority": "High",
    },
    {
        "title": "年次決算クローズ処理",
        "t_code": "F.16",
        "scope_type": "回帰テスト",
        "precondition": "当年度の全伝票転記済み・残高確認完了",
        "steps": [
            {"action": "F.16を起動し年次決算繰越パラメータを設定", "expected": "繰越設定画面が表示される", "t_code": "F.16"},
            {"action": "テスト実行（Test Run）で結果を確認", "expected": "繰越対象勘定科目の一覧が表示される", "t_code": "F.16"},
            {"action": "本実行で繰越を実施", "expected": "翌年度残高が作成される", "t_code": "F.16"},
            {"action": "FS10Nで翌年度冒頭残高を確認", "expected": "繰越残高が正確に反映されている", "t_code": "FS10N"},
        ],
        "test_data": "会計年度: 前年度, 繰越対象: 貸借対照表勘定（PL勘定は0クリア）",
        "authorization": "F_BKPF_BUK, F_FAGL_D04（期間管理）",
        "priority": "Medium",
    },
]

# MMシナリオテンプレート
_MM_SCENARIOS = [
    {
        "title": "購買依頼作成 (ME51N)",
        "t_code": "ME51N",
        "scope_type": "ハッピーパス",
        "precondition": "購買組織・勘定設定コード・マテリアルマスタが存在",
        "steps": [
            {"action": "ME51Nを起動", "expected": "購買依頼作成画面が表示される", "t_code": "ME51N"},
            {"action": "品目コード・数量・納入日・プラントを入力", "expected": "品目の説明・単位が自動補完される", "t_code": "ME51N"},
            {"action": "勘定設定コードを入力（費用計上先）", "expected": "コスト配分情報が入力される", "t_code": "ME51N"},
            {"action": "保存（Ctrl+S）", "expected": "購買依頼番号が採番される", "t_code": "ME51N"},
        ],
        "test_data": "品目コード: 1000001, 数量: 10EA, プラント: 1000",
        "authorization": "M_BANF_BSA（購買依頼作成）",
        "priority": "High",
    },
    {
        "title": "発注書作成 (ME21N)",
        "t_code": "ME21N",
        "scope_type": "ハッピーパス",
        "precondition": "仕入先マスタ・品目マスタ・購買情報レコードが存在",
        "steps": [
            {"action": "ME21Nを起動し発注書タイプ（通常発注）を選択", "expected": "発注書作成画面が表示される", "t_code": "ME21N"},
            {"action": "仕入先コード・発注日・納入日を入力", "expected": "仕入先情報が自動補完される", "t_code": "ME21N"},
            {"action": "品目・数量・単価を入力", "expected": "金額が自動計算される", "t_code": "ME21N"},
            {"action": "保存", "expected": "発注書番号（4500XXXXXX）が採番される", "t_code": "ME21N"},
            {"action": "ME22Nで発注内容を確認", "expected": "入力した内容が正確に保存されている", "t_code": "ME22N"},
        ],
        "test_data": "仕入先: V-10001, 品目: 100-100, 数量: 100EA, 単価: 1,000JPY",
        "authorization": "M_EKPO_EKG（発注品目グループ）, M_EKKO_BSA（発注書タイプ）",
        "priority": "High",
    },
    {
        "title": "商品受領 (MIGO)",
        "t_code": "MIGO",
        "scope_type": "ハッピーパス",
        "precondition": "発注書が存在・入荷予定数が残っている",
        "steps": [
            {"action": "MIGOを起動し「商品受領」「発注書」を選択", "expected": "商品受領入力画面が表示される", "t_code": "MIGO"},
            {"action": "発注書番号を入力し明細を呼び出す", "expected": "発注明細が表示される", "t_code": "MIGO"},
            {"action": "受領数量・保管場所・移動タイプ（101）を確認", "expected": "受領数量が編集可能状態", "t_code": "MIGO"},
            {"action": "「OK」チェックをつけて転記", "expected": "マテリアル伝票番号（5000XXXXXX）が採番される", "t_code": "MIGO"},
            {"action": "MMBEで在庫残高を確認", "expected": "受領数量が在庫に加算されている", "t_code": "MMBE"},
        ],
        "test_data": "発注書: 4500000001, 受領数量: 100EA, 保管場所: 0001",
        "authorization": "M_MSEG_BWA（移動タイプ権限）, M_MSEG_WMB（保管場所）",
        "priority": "High",
    },
    {
        "title": "在庫照会 (MMBE)",
        "t_code": "MMBE",
        "scope_type": "回帰テスト",
        "precondition": "マテリアルマスタが存在",
        "steps": [
            {"action": "MMBEを起動し品目コード・プラントを入力", "expected": "在庫照会画面が起動する", "t_code": "MMBE"},
            {"action": "在庫タイプ（制限なし・品質検査・ブロック）を確認", "expected": "各区分の在庫数が表示される", "t_code": "MMBE"},
            {"action": "保管場所別の在庫数を確認", "expected": "保管場所ごとの内訳が一覧表示される", "t_code": "MMBE"},
        ],
        "test_data": "品目コード: 1000001, プラント: 1000",
        "authorization": "M_MARA_MAR（品目マスタ照会）",
        "priority": "Medium",
    },
    {
        "title": "在庫移動（場所間転送） (MIGO 311)",
        "t_code": "MIGO",
        "scope_type": "ハッピーパス",
        "precondition": "移動元保管場所に十分な在庫がある",
        "steps": [
            {"action": "MIGOを起動し「その他」「転送」を選択", "expected": "在庫移動画面が起動", "t_code": "MIGO"},
            {"action": "移動タイプ311を選択", "expected": "移動元・移動先の保管場所フィールドが表示される", "t_code": "MIGO"},
            {"action": "品目・数量・移動元/移動先保管場所を入力", "expected": "入力値が反映される", "t_code": "MIGO"},
            {"action": "転記を実行", "expected": "マテリアル伝票が採番・在庫が移動先に反映される", "t_code": "MIGO"},
        ],
        "test_data": "移動タイプ: 311, 品目: 1000001, 数量: 50EA, 移動先: 0002",
        "authorization": "M_MSEG_BWA, M_MSEG_WMB",
        "priority": "Medium",
    },
]

# SDシナリオテンプレート
_SD_SCENARIOS = [
    {
        "title": "受注作成 (VA01)",
        "t_code": "VA01",
        "scope_type": "ハッピーパス",
        "precondition": "顧客マスタ・品目マスタ・価格条件が設定済み",
        "steps": [
            {"action": "VA01を起動し受注タイプ（ZOR）を選択", "expected": "受注作成: 概要画面が表示される", "t_code": "VA01"},
            {"action": "顧客番号・受注日・希望納品日を入力", "expected": "顧客情報が自動補完される", "t_code": "VA01"},
            {"action": "品目コード・数量を明細に入力", "expected": "価格が自動計算される", "t_code": "VA01"},
            {"action": "与信チェック結果を確認", "expected": "与信内でブロックなし、または警告が表示される", "t_code": "VA01"},
            {"action": "保存", "expected": "受注番号が採番される（例: 0000012345）", "t_code": "VA01"},
        ],
        "test_data": "顧客コード: C-10001, 品目: FG-001, 数量: 100EA, 希望納品日: T+7日",
        "authorization": "V_VBAK_AAT（受注タイプ）, V_VBAK_VKO（販売組織）",
        "priority": "High",
    },
    {
        "title": "出荷作成 (VL01N)",
        "t_code": "VL01N",
        "scope_type": "ハッピーパス",
        "precondition": "受注が存在・在庫が十分にある",
        "steps": [
            {"action": "VL01Nを起動し出荷ポイント・出荷日を入力", "expected": "出荷作成画面が表示される", "t_code": "VL01N"},
            {"action": "受注番号を入力し明細を呼び出す", "expected": "出荷対象の明細が表示される", "t_code": "VL01N"},
            {"action": "数量を確認（一括出荷/分割出荷）", "expected": "出荷数量が編集可能", "t_code": "VL01N"},
            {"action": "ピッキングリストを作成", "expected": "倉庫への出庫指示が生成される", "t_code": "VL01N"},
            {"action": "商品発行（出庫転記）", "expected": "商品が在庫から差し引かれ出荷伝票番号が採番", "t_code": "VL01N"},
        ],
        "test_data": "出荷ポイント: SP01, 受注: 0000012345, 数量: 100EA",
        "authorization": "V_LIKP_VST（出荷ポイント）",
        "priority": "High",
    },
    {
        "title": "請求書作成 (VF01)",
        "t_code": "VF01",
        "scope_type": "ハッピーパス",
        "precondition": "出荷が商品発行済み",
        "steps": [
            {"action": "VF01を起動し請求対象（出荷）を選択", "expected": "請求書作成画面が表示される", "t_code": "VF01"},
            {"action": "出荷番号を入力し明細を確認", "expected": "価格・税額が自動計算される", "t_code": "VF01"},
            {"action": "保存（転記）", "expected": "請求書番号（90XXXXXXXX）が採番・FIへ会計転記される", "t_code": "VF01"},
        ],
        "test_data": "出荷伝票: 800000001",
        "authorization": "V_VBRK_FKA（請求書タイプ）",
        "priority": "High",
    },
    {
        "title": "受注変更（数量変更） (VA02)",
        "t_code": "VA02",
        "scope_type": "回帰テスト",
        "precondition": "受注が存在・出荷/請求が未処理",
        "steps": [
            {"action": "VA02を起動し受注番号を入力", "expected": "受注変更画面が表示される", "t_code": "VA02"},
            {"action": "対象明細の数量を変更", "expected": "変更後金額が再計算される", "t_code": "VA02"},
            {"action": "保存", "expected": "変更が保存され変更ログが記録される", "t_code": "VA02"},
        ],
        "test_data": "受注: 0000012345, 変更前数量: 100EA, 変更後数量: 80EA",
        "authorization": "V_VBAK_AAT",
        "priority": "Medium",
    },
    {
        "title": "請求書キャンセル (VF11)",
        "t_code": "VF11",
        "scope_type": "回帰テスト",
        "precondition": "キャンセル対象の請求書が転記済み・会計期間がオープン",
        "steps": [
            {"action": "VF11を起動し請求書番号を入力", "expected": "キャンセル画面が表示される", "t_code": "VF11"},
            {"action": "キャンセル理由を入力", "expected": "キャンセル理由が入力される", "t_code": "VF11"},
            {"action": "実行", "expected": "キャンセル伝票番号が採番・FIの会計伝票が逆仕訳される", "t_code": "VF11"},
        ],
        "test_data": "請求書: 90000001, キャンセル理由: 01（訂正）",
        "authorization": "V_VBRK_FKA",
        "priority": "Medium",
    },
]

# 簡易バージョン（他のモジュール）
_GENERIC_SCENARIOS = {
    "PP": [
        {"title": "MRP実行 (MD01)", "t_code": "MD01", "scope_type": "ハッピーパス",
         "precondition": "プラント・品目マスタ・BOMが設定済み",
         "steps": [
             {"action": "MD01を起動しプラント・MRPコントローラを入力", "expected": "MRPパラメータ画面が表示される", "t_code": "MD01"},
             {"action": "処理モード・スケジューリングを設定し実行", "expected": "MRP計算が起動する", "t_code": "MD01"},
             {"action": "MD04で計画状況を確認", "expected": "計画オーダー・購買依頼が生成されている", "t_code": "MD04"},
         ],
         "test_data": "プラント: 1000, 品目: FG-001",
         "authorization": "M_PLAF_BWA（計画オーダー）",
         "priority": "High"},
        {"title": "製造オーダー作成 (CO01)", "t_code": "CO01", "scope_type": "ハッピーパス",
         "precondition": "品目マスタ・BOM・作業手順が存在",
         "steps": [
             {"action": "CO01を起動し品目・数量・プラントを入力", "expected": "製造オーダー作成画面が表示", "t_code": "CO01"},
             {"action": "部品リスト・作業リストを確認", "expected": "BOMと作業手順が展開される", "t_code": "CO01"},
             {"action": "リリース（F8）して保存", "expected": "製造オーダー番号が採番される", "t_code": "CO01"},
         ],
         "test_data": "品目: FG-001, 数量: 100EA, 基準日: T+3日",
         "authorization": "C_AFKO_AWK（製造オーダータイプ）",
         "priority": "High"},
    ],
    "HR": [
        {"title": "個人データ更新 (PA30)", "t_code": "PA30", "scope_type": "ハッピーパス",
         "precondition": "従業員マスタが存在",
         "steps": [
             {"action": "PA30を起動し従業員番号・インフォタイプ・期間を入力", "expected": "個人データ管理画面が表示される", "t_code": "PA30"},
             {"action": "対象インフォタイプを選択して変更", "expected": "データ入力フィールドが表示される", "t_code": "PA30"},
             {"action": "変更内容を入力して保存", "expected": "変更履歴が記録される（有効日付管理）", "t_code": "PA30"},
         ],
         "test_data": "従業員: 10000001, インフォタイプ: 0002（個人データ）",
         "authorization": "P_ORGIN（組織権限チェック）",
         "priority": "High"},
        {"title": "給与計算実行 (PC00_M01_CALC)", "t_code": "PC00_M01_CALC", "scope_type": "回帰テスト",
         "precondition": "給与期間がオープン・勤怠データが確定済み",
         "steps": [
             {"action": "給与計算トランザクションを起動", "expected": "パラメータ入力画面が表示される", "t_code": "PC00_M01_CALC"},
             {"action": "計算期間・テスト実行フラグを設定", "expected": "パラメータが入力される", "t_code": "PC00_M01_CALC"},
             {"action": "実行（テストラン）", "expected": "ログが出力され計算結果が表示される", "t_code": "PC00_M01_CALC"},
             {"action": "エラーログを確認", "expected": "エラー0件・警告が許容範囲内", "t_code": "PC00_M01_CALC"},
         ],
         "test_data": "対象月: 給与期間, 給与区分: 01（正社員）",
         "authorization": "P_PAYDT（給与データ処理）",
         "priority": "High"},
    ],
    "basis": [
        {"title": "ユーザー作成・権限付与 (SU01)", "t_code": "SU01", "scope_type": "ハッピーパス",
         "precondition": "ロールが存在・パスワードポリシーが設定済み",
         "steps": [
             {"action": "SU01を起動し新規ユーザーIDを入力", "expected": "ユーザーメンテナンス画面が表示される", "t_code": "SU01"},
             {"action": "氏名・メールアドレス・ユーザータイプを入力", "expected": "ユーザー基本情報が入力される", "t_code": "SU01"},
             {"action": "ロールタブでロールを割り当て", "expected": "ロールが追加される", "t_code": "SU01"},
             {"action": "パスワードを設定して保存", "expected": "ユーザーが作成される", "t_code": "SU01"},
             {"action": "SU53でユーザーの権限確認", "expected": "必要な権限オブジェクトが付与されている", "t_code": "SU53"},
         ],
         "test_data": "ユーザーID: TEST_USER01, タイプ: Dialog",
         "authorization": "S_USER_GRP（ユーザー管理グループ）",
         "priority": "High"},
        {"title": "クライアント管理設定 (SCC4)", "t_code": "SCC4", "scope_type": "認可テスト",
         "precondition": "BASIS権限を持つユーザーでログイン",
         "steps": [
             {"action": "SCC4を起動してクライアント一覧を表示", "expected": "クライアント一覧が表示される", "t_code": "SCC4"},
             {"action": "テストクライアントを選択して設定を確認", "expected": "クライアント設定画面が表示される", "t_code": "SCC4"},
             {"action": "変更モードで設定値を確認（変更は実施しない）", "expected": "設定内容が正確に表示される", "t_code": "SCC4"},
         ],
         "test_data": "クライアント: 200（テスト）",
         "authorization": "S_TABU_DIS（テーブル参照）, S_ADMI_FCD（管理機能）",
         "priority": "Medium"},
    ],
    "PS": [
        {"title": "プロジェクト構造作成 (CJ01)", "t_code": "CJ01", "scope_type": "ハッピーパス",
         "precondition": "プロジェクト定義・プロファイルが設定済み",
         "steps": [
             {"action": "CJ01を起動しプロジェクト定義を入力", "expected": "プロジェクト作成画面が表示", "t_code": "CJ01"},
             {"action": "WBSエレメントを作成（階層構造）", "expected": "WBS階層が展開できる", "t_code": "CJ01"},
             {"action": "保存", "expected": "プロジェクト番号が採番される", "t_code": "CJ01"},
         ],
         "test_data": "プロジェクト: PROJ-2026-001, 期間: 2026-01〜2026-12",
         "authorization": "C_PRPS_KOK（コントロールエリア）",
         "priority": "Medium"},
    ],
    "WM": [
        {"title": "入庫転送指示作成 (LT01)", "t_code": "LT01", "scope_type": "ハッピーパス",
         "precondition": "入荷完了（MIGO）・保管ビンが存在",
         "steps": [
             {"action": "LT01を起動し倉庫番号・移動タイプを入力", "expected": "転送指示作成画面が表示", "t_code": "LT01"},
             {"action": "転送対象の品目・数量を入力", "expected": "入庫候補が表示される", "t_code": "LT01"},
             {"action": "保管ビンを選択して保存", "expected": "転送指示番号が採番される", "t_code": "LT01"},
         ],
         "test_data": "倉庫番号: WH001, 移動タイプ: 501",
         "authorization": "L_TAQUI（転送指示）",
         "priority": "Medium"},
    ],
    "custom": [
        {"title": "カスタムレポート出力テスト", "t_code": "ZRPT001", "scope_type": "ハッピーパス",
         "precondition": "カスタムプログラムが本番同等データで実行可能",
         "steps": [
             {"action": "カスタムTコードを起動し選択条件を入力", "expected": "選択画面が表示される", "t_code": "ZRPT001"},
             {"action": "テストデータに基づく条件を入力して実行", "expected": "出力が生成される", "t_code": "ZRPT001"},
             {"action": "出力内容を標準機能の結果と比較", "expected": "差異が0件または許容範囲内", "t_code": "ZRPT001"},
         ],
         "test_data": "選択条件は業務要件に従い設定",
         "authorization": "Z_RAUTH（カスタム権限オブジェクト）",
         "priority": "High"},
    ],
}

_SCENARIOS_BY_MODULE = {
    "FI": _FI_SCENARIOS,
    "MM": _MM_SCENARIOS,
    "SD": _SD_SCENARIOS,
    **{k: v for k, v in _GENERIC_SCENARIOS.items()},
}

_MASTER_DATA_CHECKLISTS = {
    "FI": ["会社コードが設定されている", "勘定科目（GL）が存在し開設されている",
           "会計期間がオープンである", "為替レートが更新されている"],
    "MM": ["品目マスタ（購買/MRP/在庫ビュー）が完全", "仕入先マスタが存在",
           "購買情報レコードが設定されている", "プラント/保管場所が設定されている"],
    "SD": ["顧客マスタ（一般/会社/販売組織ビュー）が完全", "品目マスタ（販売ビュー）が存在",
           "価格条件（VK11）が設定されている", "与信管理が設定されている"],
    "PP": ["品目マスタ（PP/作業スケジューリングビュー）が完全", "BOM（CS01）が展開可能",
           "作業手順（CA01）が存在", "作業区（CR01）が設定されている"],
    "HR": ["組織構造（O/S/P）が設定されている", "従業員マスタが存在",
           "給与区分が設定されている", "勤怠ルールが設定されている"],
    "basis": ["システムパラメータが設定済み", "トランスポートルートが設定されている",
              "バックグラウンドジョブスケジュールが確認済み"],
}

_TRANSPORT_CHECKLIST = [
    "開発クライアントのオブジェクトがトランスポートに収集されている",
    "テストシステムへのインポートが完了している",
    "本番インポートの手順・ロールバック計画が承認されている",
    "移送対象のカスタムオブジェクト（Z/Y）が全てトランスポートに含まれている",
    "移送依頼番号をITSMチケットに紐づけて管理している",
    "本番インポートは業務時間外（メンテナンスウィンドウ）に実施する計画がある",
]

_SCOPE_TO_SCENARIOS = {
    "happy_path": lambda scenarios: [s for s in scenarios if s["scope_type"] in ("ハッピーパス",)],
    "regression": lambda scenarios: [s for s in scenarios if s["scope_type"] in ("回帰テスト", "ハッピーパス")],
    "authorization": lambda scenarios: [s for s in scenarios if s["scope_type"] in ("認可テスト", "ハッピーパス")],
    "integration": lambda scenarios: scenarios,
    "data_migration": lambda scenarios: scenarios[:3],
    "performance": lambda scenarios: scenarios[:2],
}


def sap_scenario_gen(module, process, scope):
    """SAPテストシナリオを生成する。"""
    mod = module or "FI"
    proc = process or ""

    if not scope:
        scope = ["happy_path"]
    if isinstance(scope, str):
        scope = [scope]

    all_scenarios = _SCENARIOS_BY_MODULE.get(mod, _FI_SCENARIOS)

    # スコープに基づいてシナリオをフィルタ
    selected = []
    for s_key in scope:
        filter_fn = _SCOPE_TO_SCENARIOS.get(s_key, lambda x: x)
        for sc in filter_fn(all_scenarios):
            if sc not in selected:
                selected.append(sc)

    if not selected:
        selected = all_scenarios[:3]

    # ID採番
    result_scenarios = []
    for i, sc in enumerate(selected, 1):
        s = dict(sc)
        s["id"] = f"SAP-{i:03d}"
        s["module"] = _SAP_MODULES.get(mod, mod)
        if proc:
            s["precondition"] = f"{proc}（{s['precondition']}）"
        result_scenarios.append(s)

    return {
        "scenarios": result_scenarios,
        "master_data_checklist": _MASTER_DATA_CHECKLISTS.get(mod, [
            "マスタデータが本番同等の状態で存在している",
            "カスタマイジング設定がテスト系に移送されている",
        ]),
        "transport_checklist": _TRANSPORT_CHECKLIST,
        "total": len(result_scenarios),
        "module": _SAP_MODULES.get(mod, mod),
    }
