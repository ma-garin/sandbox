// 画面共通の表示処理
export function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
  el.classList.add('is-error');
}

export function clearError(el) {
  el.textContent = '';
  el.hidden = true;
  el.classList.remove('is-error');
}

export function setLoading(button, loading) {
  button.disabled = loading;
  button.classList.toggle('is-loading', loading);
}

export function markField(input, message) {
  if (message) {
    input.classList.add('is-error');
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.classList.remove('is-error');
    input.removeAttribute('aria-invalid');
  }
}
