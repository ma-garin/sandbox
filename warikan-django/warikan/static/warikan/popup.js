// 仕様 3.1 エラー通知 / 仕様 3 登録完了通知のポップアップ制御。
// 表示中はオーバーレイが画面全体を覆うため、消去操作以外の操作ができない。

(function () {
  "use strict";

  var overlay = document.getElementById("popup-overlay");
  var message = document.getElementById("popup-message");
  if (!overlay || !message) {
    return;
  }

  function show(text, options) {
    var settings = options || {};
    message.textContent = text;
    overlay.hidden = false;
    overlay.dataset.dismissible = settings.dismissible === false ? "0" : "1";

    if (settings.durationMs) {
      window.setTimeout(function () {
        overlay.hidden = true;
        if (settings.redirectTo) {
          window.location.href = settings.redirectTo;
        }
      }, settings.durationMs);
    }
  }

  // ポップアップの外側をタップすると消去される。
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay && overlay.dataset.dismissible !== "0") {
      overlay.hidden = true;
    }
  });

  // サーバから渡された初期メッセージ（エラー通知）を表示する。
  var initial = document.body.dataset.popup;
  if (initial) {
    var duration = parseInt(document.body.dataset.popupDuration || "0", 10);
    show(initial, {
      durationMs: duration || undefined,
      dismissible: !duration,
      redirectTo: document.body.dataset.popupRedirect || undefined,
    });
  }

  // 本実装の対象外である機能（新規登録サイトなど）の通知。
  document.querySelectorAll("[data-popup-text]").forEach(function (element) {
    element.addEventListener("click", function (event) {
      event.preventDefault();
      show(element.dataset.popupText);
    });
  });

  window.warikanPopup = { show: show };
})();
