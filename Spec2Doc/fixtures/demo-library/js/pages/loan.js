import { getMember, createLoan } from '../api.js';
import { loadSession, saveLoanDraft, loadLoanDraft, clearLoanDraft } from '../store.js';
import { validateMemberId, validateIsbn, validateLoanCount, collectErrors } from '../validate.js';
import { canLoan, dueDays } from '../loan-rules.js';
import { showError, clearError, setLoading } from '../ui.js';

const form = document.getElementById('loan-form');
const errorBox = document.getElementById('loan-error');
const submit = document.getElementById('loan-submit');
const summary = document.getElementById('member-summary');
let currentMember = null;

function readForm() {
  return {
    memberId: document.getElementById('loan-member-id').value.trim(),
    isbn: document.getElementById('loan-isbn').value.trim(),
    count: Number(document.getElementById('loan-count').value),
    days: Number(document.getElementById('loan-days').value),
  };
}

function restoreDraft() {
  const draft = loadLoanDraft();
  if (!draft) return;
  document.getElementById('loan-member-id').value = draft.memberId ?? '';
  document.getElementById('loan-isbn').value = draft.isbn ?? '';
  document.getElementById('loan-count').value = String(draft.count ?? 1);
}

async function handleCheckMember() {
  clearError(errorBox);
  const { memberId } = readForm();
  const idError = validateMemberId(memberId);
  if (idError) {
    showError(errorBox, idError);
    return;
  }
  const session = loadSession();
  try {
    currentMember = await getMember(memberId, session.token);
    summary.textContent = `${currentMember.name}（貸出中 ${currentMember.currentLoans} 冊）`;
    summary.classList.toggle('is-overdue', currentMember.hasOverdue === true);
  } catch (err) {
    currentMember = null;
    showError(errorBox, err.status === 404 ? '会員が見つかりません。会員番号を確認してください' : err.message);
  }
}

async function handleLoan(event) {
  event.preventDefault();
  clearError(errorBox);
  const data = readForm();
  const errors = collectErrors([validateMemberId(data.memberId), validateIsbn(data.isbn), validateLoanCount(data.count)]);
  if (errors.length > 0) {
    showError(errorBox, errors[0]);
    return;
  }
  if (!currentMember || currentMember.id !== data.memberId) {
    showError(errorBox, '先に「会員を確認」を押してください');
    return;
  }
  const decision = canLoan(currentMember, currentMember.currentLoans, data.count);
  if (!decision.ok) {
    showError(errorBox, decision.reason);
    return;
  }
  setLoading(submit, true);
  try {
    const session = loadSession();
    await createLoan({ memberId: data.memberId, isbn: data.isbn, count: data.count, days: Math.min(data.days, dueDays(currentMember.type)) }, session.token);
    clearLoanDraft();
    window.location.href = 'returns.html';
  } catch (err) {
    showError(errorBox, err.message || '貸出に失敗しました。時間をおいて再度お試しください');
  } finally {
    setLoading(submit, false);
  }
}

form.addEventListener('submit', handleLoan);
document.getElementById('check-member').addEventListener('click', handleCheckMember);
document.getElementById('loan-save-draft').addEventListener('click', () => saveLoanDraft(readForm()));
restoreDraft();
