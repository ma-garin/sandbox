/**
 * ホーム画面に置いてもらうための案内。
 *
 * 出し方には決まりごとがある。
 *   ・初回ロードでは出さない。何かを記録し終えた直後に出す
 *   ・prompt() は保持した beforeinstallprompt につき1回しか呼べない
 *   ・iOS Safari には beforeinstallprompt が来ない。手順を自分で書くしかない
 * 断られたら二度と出さない（うるさい案内は帳面の邪魔になる）。
 */

const KEY_DISMISSED = 'omikuji.installDismissed.v1';

let deferredPrompt = null;
let listeners = [];

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS 13+ は Mac を名乗るので、タッチの有無で見分ける
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function dismissed() {
  return localStorage.getItem(KEY_DISMISSED) === '1';
}

export function markDismissed() {
  localStorage.setItem(KEY_DISMISSED, '1');
}

/** ブラウザから「入れられます」と言われたか。iOS では常に false になる。 */
export function canPrompt() {
  return Boolean(deferredPrompt);
}

/**
 * iOS では自動で出せないので、手順を出すべきかを別に判定する。
 * すでにホーム画面から開いているなら不要。
 */
export function needsManualHint() {
  return isIOS() && !isStandalone() && !dismissed();
}

/** 案内を出せる状態になったら呼ばれる。 */
export function onAvailable(fn) {
  listeners.push(fn);
  if (canPrompt()) fn();
}

export function watch() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // 既定のミニバーを止めて、こちらの都合のよい場面で出す
    event.preventDefault();
    deferredPrompt = event;
    listeners.forEach((fn) => fn());
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markDismissed();
  });
}

/**
 * 実際にブラウザの追加ダイアログを出す。
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;          // 1回しか使えないので、先に手放す
  event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'dismissed') markDismissed();
  return outcome;
}

/** iOS 向けの手順。ブラウザごとに操作が違うので、Safari の言い方に寄せる。 */
export const IOS_STEPS = [
  '画面の下にある「共有」ボタン（□に↑）を押す',
  'メニューを下にたどって「ホーム画面に追加」を選ぶ',
  '右上の「追加」を押す',
];
