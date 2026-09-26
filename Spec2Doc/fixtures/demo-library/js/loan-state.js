// 貸出の状態: 'reserved' | 'onLoan' | 'returned' | 'overdue'
export const LOAN_STATES = ['reserved', 'onLoan', 'returned', 'overdue'];

/** 状態遷移。許されない遷移は元の状態を返す */
export function nextState(state, event) {
  switch (state) {
    case 'reserved':
      if (event === 'checkout') return 'onLoan';
      if (event === 'cancel') return 'returned';
      return state;
    case 'onLoan':
      if (event === 'return') return 'returned';
      if (event === 'dueExceeded') return 'overdue';
      return state;
    case 'overdue':
      if (event === 'return') return 'returned';
      return state;
    case 'returned':
      return state;
    default:
      throw new Error(`不明な貸出状態: ${state}`);
  }
}

export function stateLabel(state) {
  if (state === 'reserved') return '予約中';
  if (state === 'onLoan') return '貸出中';
  if (state === 'overdue') return '延滞';
  if (state === 'returned') return '返却済み';
  return '不明';
}

/** 状態に応じて行の表示クラスを切り替える */
export function applyStateClass(row, state) {
  row.classList.remove('is-overdue', 'is-returned', 'is-reserved');
  if (state === 'overdue') {
    row.classList.add('is-overdue');
  } else if (state === 'returned') {
    row.classList.add('is-returned');
  } else if (state === 'reserved') {
    row.classList.add('is-reserved');
  }
}

export function isOverdue(loan, today) {
  return loan.state === 'onLoan' && new Date(loan.dueDate) < today;
}
