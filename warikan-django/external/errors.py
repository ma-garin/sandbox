"""外部サービス呼び出しで発生しうるエラー。"""


class ServiceUnavailableError(Exception):
    """サービスサーバと正常に通信できない場合に送出する（仕様 3.5）。"""


class AuthenticationFailedError(Exception):
    """ID が未登録、またはパスワードが不正な場合に送出する（仕様 1.1.2）。"""
