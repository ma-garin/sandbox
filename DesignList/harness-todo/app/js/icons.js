/* ============================================================
   Harness. — アイコン集（インラインSVG / stroke ベース）
   currentColor 継承。使用側は ic('home') で SVG 文字列を得る。
   ============================================================ */
(function (global) {
  'use strict';

  var P = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  // 各アイコンは <path>/<line> などの内側マークアップのみを持つ
  var PATHS = {
    check:      '<path d="M20 6 9 17l-5-5"/>',
    home:       '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    list:       '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    calendar:   '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/>',
    folder:     '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5Z"/>',
    user:       '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    bell:       '<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun:        '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:       '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5"/>',
    search:     '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    plus:       '<path d="M12 5v14M5 12h14"/>',
    filter:     '<path d="M3 5h18l-7 8v5l-4 2v-7Z"/>',
    chevronDown:'<path d="m6 9 6 6 6-6"/>',
    chevronLeft:'<path d="m15 18-6-6 6-6"/>',
    chevronRight:'<path d="m9 6 6 6-6 6"/>',
    x:          '<path d="M18 6 6 18M6 6l12 12"/>',
    trash:      '<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/>',
    alert:      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    activity:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
    hourglass:  '<circle cx="12" cy="12" r="9"/><path d="M9 9h6"/><path d="M9 15h6"/><path d="M10 9c0 2 4 2 4 6"/>',
    edit:       '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 6.5l3 3"/>',
    database:   '<ellipse cx="12" cy="5.5" rx="7" ry="3"/><path d="M5 5.5v13c0 1.7 3.1 3 7 3s7-1.3 7-3v-13"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    logout:     '<path d="M14 4h4a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4"/><path d="M10 12H3.5"/><path d="m7 8.5-3.5 3.5L7 15.5"/>',
    reset:      '<path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1"/><path d="M3.5 19v-4h4"/>',
    info:       '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };

  function attrs() {
    return Object.keys(P).map(function (k) { return k + '="' + P[k] + '"'; }).join(' ');
  }

  function ic(name, size) {
    var inner = PATHS[name];
    if (!inner) { return ''; }
    var s = size || 20;
    return '<svg class="ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' + attrs() + '>' + inner + '</svg>';
  }

  // Google の "G"（ブランドカラー）
  function googleG() {
    return '<svg class="g" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4"/>' +
      '<path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22"/>' +
      '<path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z"/>' +
      '<path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1"/>' +
      '</svg>';
  }

  global.ic = ic;
  global.googleG = googleG;
})(window);
