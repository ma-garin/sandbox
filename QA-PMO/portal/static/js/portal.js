/* portal.js — サイドナビ折りたたみ ＋ Chart.js 自動描画（提案B）。
 * 計算ロジックはサーバー側（Django）。JSは描画とUX補助のみ。
 */
function bindNav(root) {
  (root || document).querySelectorAll(".nav-sec-head").forEach(function (head) {
    if (head.dataset.bound) return;
    head.dataset.bound = "1";
    head.addEventListener("click", function () {
      head.closest(".nav-section").classList.toggle("open");
    });
  });
  (root || document).querySelectorAll(".nav-sub-head").forEach(function (head) {
    if (head.dataset.bound) return;
    head.dataset.bound = "1";
    head.addEventListener("click", function () {
      head.closest(".nav-sub").classList.toggle("open");
    });
  });
}

/* <canvas data-chart='{...Chart.js config...}'> を見つけて描画。
 * 初回ロードでも HTMX 部分更新後でも同じ処理で動く。 */
function initCharts(root) {
  if (typeof Chart === "undefined") return;
  (root || document).querySelectorAll("canvas[data-chart]").forEach(function (c) {
    if (c.dataset.rendered) return;
    c.dataset.rendered = "1";
    try {
      new Chart(c, JSON.parse(c.dataset.chart));
    } catch (e) {
      /* 設定不正でも画面は壊さない */
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  bindNav();
  initCharts();
});

/* HTMX 部分更新後に、差し替わった領域だけ再初期化 */
document.body.addEventListener("htmx:afterSwap", function (e) {
  bindNav(e.target);
  initCharts(e.target);
});
