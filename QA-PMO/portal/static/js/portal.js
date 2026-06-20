/* portal.js — サイドナビの折りたたみトグルのみ（最小限のJS）。
 * 主要ロジックはすべてサーバー側（Django）にあり、画面はサーバーレンダリング。
 */
document.addEventListener("DOMContentLoaded", function () {
  // 区分の開閉
  document.querySelectorAll(".nav-sec-head").forEach(function (head) {
    head.addEventListener("click", function () {
      head.closest(".nav-section").classList.toggle("open");
    });
  });
  // サブグループの開閉
  document.querySelectorAll(".nav-sub-head").forEach(function (head) {
    head.addEventListener("click", function () {
      head.closest(".nav-sub").classList.toggle("open");
    });
  });
});
