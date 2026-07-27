// 仕様 1.2.3 支払いの割合：スライダーの値に連動して下の文字を更新する。

(function () {
  "use strict";

  var slider = document.getElementById("id_own_ratio");
  var output = document.getElementById("ratio-value");
  if (!slider || !output) {
    return;
  }

  function render() {
    output.textContent = "自分側の支払割合: " + slider.value;
    // 仕様書の画面イメージに合わせ、自分側をオレンジ、相手側を青で塗り分ける。
    var ratio = Number(slider.value);
    slider.style.background =
      "linear-gradient(to right, #f5a623 0%, #f5a623 " +
      ratio +
      "%, #4285f4 " +
      ratio +
      "%, #4285f4 100%)";
  }

  slider.addEventListener("input", render);
  render();
})();
