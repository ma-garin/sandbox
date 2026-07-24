/* ============================================================
   showcase.js — ショーケース共通のインタラクション（デザイン中立）
   data-* 属性で宣言的に動かす:
     [data-toggle-theme]        … ライト/ダーク切替（<html data-theme>）
     [data-tabs] > [data-tab=x] … タブ切替、対応する [data-panel=x] を表示
     [data-open-modal="id"]     … #id の [data-modal] を開く
     [data-close-modal]         … 直近の [data-modal] を閉じる
     [data-toast="msg"]         … トースト表示
     [data-copy="text"]         … クリップボードにコピー＋トースト
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  // OS設定から初期テーマを決定（未指定時のみ）
  if (!root.getAttribute('data-theme')) {
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
  syncThemeLabels();

  function syncThemeLabels() {
    var isDark = root.getAttribute('data-theme') === 'dark';
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-label]'), function (el) {
      el.textContent = isDark ? 'ダーク' : 'ライト';
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('sc-toast');
    if (!t) { t = document.createElement('div'); t.id = 'sc-toast'; t.className = 'sc-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  document.addEventListener('click', function (e) {
    var el;

    if ((el = e.target.closest('[data-toggle-theme]'))) {
      root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      syncThemeLabels();
      return;
    }

    if ((el = e.target.closest('[data-tab]'))) {
      var group = el.closest('[data-tabs]');
      if (group) {
        var id = el.getAttribute('data-tab');
        Array.prototype.forEach.call(group.querySelectorAll('[data-tab]'), function (b) {
          b.classList.toggle('is-active', b === el);
          b.setAttribute('aria-selected', b === el ? 'true' : 'false');
        });
        Array.prototype.forEach.call(group.querySelectorAll('[data-panel]'), function (p) {
          p.hidden = p.getAttribute('data-panel') !== id;
        });
      }
      return;
    }

    if ((el = e.target.closest('[data-open-modal]'))) {
      var m = document.getElementById(el.getAttribute('data-open-modal'));
      if (m) { m.hidden = false; }
      return;
    }

    if ((el = e.target.closest('[data-close-modal]'))) {
      var mm = el.closest('[data-modal]');
      if (mm) { mm.hidden = true; }
      return;
    }

    // モーダル背景クリックで閉じる
    if (e.target.matches('[data-modal]')) { e.target.hidden = true; return; }

    if ((el = e.target.closest('[data-copy]'))) {
      var text = el.getAttribute('data-copy');
      if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(function () {}); }
      toast('コピー: ' + text);
      return;
    }

    if ((el = e.target.closest('[data-toast]'))) {
      toast(el.getAttribute('data-toast'));
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      Array.prototype.forEach.call(document.querySelectorAll('[data-modal]'), function (m) { m.hidden = true; });
    }
  });
})();
