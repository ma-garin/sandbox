import { deleteLoan, getMember } from '../api.js';
import { loadSession } from '../store.js';
import { validateMemberId, validateLoanId, collectErrors } from '../validate.js';
import { calcLateFee } from '../loan-rules.js';
import { nextState, stateLabel, applyStateClass, isOverdue } from '../loan-state.js';
import { showError, clearError, setLoading } from '../ui.js';

const form = document.getElementById('return-form');
const errorBox = document.getElementById('return-error');
const submit = document.getElementById('return-submit');
const feeDisplay = document.getElementById('fee-display');

function updateFee() {
  const days = Number(document.getElementById('overdue-days').value);
  const fee = calcLateFee(days);
  feeDisplay.textContent = `延滞料金: ${fee} 円`;
  feeDisplay.classList.toggle('is-overdue', fee > 0);
}

function renderOverdue(loans) {
  const tbody = document.querySelector('#overdue-list tbody');
  tbody.innerHTML = '';
  const today = new Date();
  for (const loan of loans) {
    const state = isOverdue(loan, today) ? nextState(loan.state, 'dueExceeded') : loan.state;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${loan.id}</td><td>${loan.title}</td><td>${loan.dueDate}</td><td>${stateLabel(state)}</td>`;
    applyStateClass(tr, state);
    tbody.appendChild(tr);
  }
}

async function refreshOverdue() {
  const session = loadSession();
  if (!session) {
    window.location.href = '../index.html';
    return;
  }
  try {
    const member = await getMember(session.memberId, session.token);
    renderOverdue(member.loans ?? []);
  } catch (err) {
    showError(errorBox, err.message || '一覧を取得できませんでした。時間をおいて再度お試しください');
  }
}

async function handleReturn(event) {
  event.preventDefault();
  clearError(errorBox);
  const memberId = document.getElementById('return-member-id').value.trim();
  const loanId = document.getElementById('return-loan-id').value.trim();
  const errors = collectErrors([validateMemberId(memberId), validateLoanId(loanId)]);
  if (errors.length > 0) {
    showError(errorBox, errors[0]);
    return;
  }
  setLoading(submit, true);
  try {
    const session = loadSession();
    await deleteLoan(loanId, session.token);
    await refreshOverdue();
  } catch (err) {
    showError(errorBox, err.status === 404 ? '貸出番号が見つかりません' : err.message);
  } finally {
    setLoading(submit, false);
  }
}

form.addEventListener('submit', handleReturn);
document.getElementById('overdue-days').addEventListener('input', updateFee);
document.getElementById('refresh-overdue').addEventListener('click', refreshOverdue);
refreshOverdue();
