import { login } from '../api.js';
import { saveSession, loadSession } from '../store.js';
import { validateMemberId, validatePassword, collectErrors } from '../validate.js';
import { showError, clearError, setLoading, markField } from '../ui.js';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submit = document.getElementById('login-submit');

function restoreMemberId() {
  const session = loadSession();
  if (session && session.memberId) {
    document.getElementById('member-id').value = session.memberId;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearError(errorBox);
  const memberInput = document.getElementById('member-id');
  const passwordInput = document.getElementById('password');
  const idError = validateMemberId(memberInput.value);
  const pwError = validatePassword(passwordInput.value);
  markField(memberInput, idError);
  markField(passwordInput, pwError);
  const errors = collectErrors([idError, pwError]);
  if (errors.length > 0) {
    showError(errorBox, errors[0]);
    return;
  }
  setLoading(submit, true);
  try {
    const res = await login(memberInput.value.trim(), passwordInput.value);
    saveSession({ memberId: memberInput.value.trim(), token: res.token, memberType: res.memberType });
    window.location.href = 'pages/search.html';
  } catch (err) {
    if (err.status === 401) {
      showError(errorBox, '会員番号またはパスワードが違います');
    } else {
      showError(errorBox, err.message || 'ログインに失敗しました。時間をおいて再度お試しください');
    }
  } finally {
    setLoading(submit, false);
  }
}

form.addEventListener('submit', handleLogin);
document.getElementById('member-id').addEventListener('input', () => clearError(errorBox));
window.addEventListener('DOMContentLoaded', restoreMemberId);
