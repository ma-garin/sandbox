// charts.js — 依存なしのSVG折れ線グラフ（不具合件数(OPEN/CLOSE)の推移表示専用）

// series: [{label, color, points:[{x:数値(通し番号), y:数値, dateLabel:string}]}]
export function lineChartSVG(series, { width = 640, height = 260 } = {}) {
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const allPoints = series.flatMap((s) => s.points);
  const legend = series
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label}</span>`)
    .join("");

  if (allPoints.length === 0) {
    return `<div class="chart-legend">${legend}</div><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-empty">データがありません</text></svg>`;
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(1, ...ys);
  const minY = 0;

  const sx = (x) => padding.left + (maxX === minX ? w / 2 : ((x - minX) / (maxX - minX)) * w);
  const sy = (y) => padding.top + h - ((y - minY) / (maxY - minY)) * h;

  const gridY = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const y = padding.top + h - t * h;
      const val = Math.round(minY + t * (maxY - minY));
      return (
        `<line x1="${padding.left}" y1="${y}" x2="${padding.left + w}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>` +
        `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis">${val}</text>`
      );
    })
    .join("");

  const lines = series
    .map((s) => {
      const pts = [...s.points].sort((a, b) => a.x - b.x);
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.y)}`).join(" ");
      const dots = pts
        .map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3" fill="${s.color}"><title>${p.dateLabel}: ${p.y}</title></circle>`)
        .join("");
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>${dots}`;
    })
    .join("");

  const xLabels = allPoints
    .filter((p, i, arr) => arr.findIndex((q) => q.x === p.x) === i)
    .sort((a, b) => a.x - b.x)
    .map((p) => `<text x="${sx(p.x)}" y="${height - 8}" text-anchor="middle" class="chart-axis">${p.dateLabel}</text>`)
    .join("");

  return (
    `<div class="chart-legend">${legend}</div>` +
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="不具合件数の推移">
      ${gridY}${lines}${xLabels}
    </svg>`
  );
}
