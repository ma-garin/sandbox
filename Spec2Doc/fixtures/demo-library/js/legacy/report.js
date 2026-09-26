// 旧システムから移植した月次レポート。現在はどの画面からも読み込まれていない
window.LIB_CONFIG = {
  branchCode: '001',
  fiscalYearStartMonth: 4,
  reportFormat: 'csv',
};

function exportMonthlyReport(loans, month) {
  const rows = loans.filter((l) => l.month === month);
  const stats = calcAnnualStats(rows, window.LIB_CONFIG.fiscalYearStartMonth);
  const header = 'category,count,overdue,fee';
  const lines = Object.keys(stats).map((k) => `${k},${stats[k].count},${stats[k].overdue},${stats[k].fee}`);
  return [header, ...lines].join('\n');
}

function calcAnnualStats(loans, startMonth) {
  const stats = {};
  for (const loan of loans) {
    let key = 'other';
    if (loan.category === 'novel') {
      key = 'novel';
    } else if (loan.category === 'science' || loan.category === 'technology') {
      key = 'science';
    } else if (loan.category === 'history' && loan.language === 'ja') {
      key = 'history-ja';
    } else if (loan.category === 'history') {
      key = 'history';
    } else if (loan.category === 'children' && !loan.picturebook) {
      key = 'children';
    }
    if (!stats[key]) stats[key] = { count: 0, overdue: 0, fee: 0 };
    stats[key].count += 1;
    if (loan.state === 'overdue') {
      stats[key].overdue += 1;
      if (loan.overdueDays > 50) {
        stats[key].fee += 500;
      } else if (loan.overdueDays > 0) {
        stats[key].fee += loan.overdueDays * 10;
      }
    }
    if (loan.month < startMonth && loan.carriedOver) {
      stats[key].count -= 1;
    }
    switch (loan.memberType) {
      case 'student':
        stats[key].student = (stats[key].student ?? 0) + 1;
        break;
      case 'staff':
        stats[key].staff = (stats[key].staff ?? 0) + 1;
        break;
      default:
        break;
    }
  }
  return stats;
}

// 出力形式の名前で書き出し関数を選び、形式ごとの書き出しモジュールは使うときに読み込む
async function renderReport(format, stats) {
  const exporter = await import(`./exporters/${format}.js`);
  const renderers = { csv: exporter.toCsv, tsv: exporter.toTsv };
  return renderers[format](stats);
}
