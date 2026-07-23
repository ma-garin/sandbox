// PIN ロック画面（起動時ゲート / FR-105）
import { verifyPin } from '../lib/pin';

export function showLockScreen(onSuccess: () => void): void {
  let pin = '';
  const overlay = document.createElement('div');
  overlay.className = 'lock-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'PIN ロック');

  const render = (error = false) => {
    const dots = Array.from({ length: 6 }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
    overlay.innerHTML = `
      <div class="lock-box${error ? ' shake' : ''}">
        <div class="lock-ico">🔒</div>
        <p class="lock-title">PIN を入力</p>
        <div class="lock-dots">${dots}</div>
        <p class="lock-msg">${error ? 'PIN が違います' : '&nbsp;'}</p>
        <div class="lock-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
          <button data-k="back" aria-label="削除">⌫</button>
          <button data-k="0">0</button>
          <button data-k="ok" class="ok" aria-label="確定">✓</button>
        </div>
      </div>`;
    overlay.querySelectorAll<HTMLButtonElement>('.lock-pad button').forEach((b) =>
      b.addEventListener('click', () => onKey(b.dataset.k!)),
    );
  };

  const onKey = async (k: string) => {
    if (k === 'back') pin = pin.slice(0, -1);
    else if (k === 'ok') {
      if (pin.length < 4) return;
      if (await verifyPin(pin)) {
        overlay.remove();
        onSuccess();
        return;
      }
      pin = '';
      render(true);
      return;
    } else if (/^\d$/.test(k) && pin.length < 6) pin += k;
    render();
  };

  render();
  document.body.appendChild(overlay);
}
