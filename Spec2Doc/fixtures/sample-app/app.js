// 入場券予約アプリ（Spec2Doc 検証用）
const STORAGE_KEY = 'reservations';
const LAST_TYPE_KEY = 'lastTicketType';
const API_BASE = '/api';
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

// 大域変数（移行論点）
var retryCount = 0;

let state = 'idle'; // 'idle' | 'loading' | 'done' | 'error'
let ticketType = 'day';
let quantity = 1;

const STATUS_TEXT = { idle: '待機中', loading: '処理中', done: '完了', error: 'エラー' };

function init() {
  state = 'idle';
  ticketType = localStorage.getItem(LAST_TYPE_KEY) || 'day';
  quantity = 1;
  document.getElementById('ticket-type').value = ticketType;
  document.getElementById('calc-button').addEventListener('click', onCalcClick);
  document.getElementById('order-form').addEventListener('submit', onSubmit);
  document.getElementById('ticket-type').addEventListener('change', (e) => {
    ticketType = e.target.value;
    localStorage.setItem(LAST_TYPE_KEY, ticketType);
  });
  render();
}

function setState(next) {
  const status = document.getElementById('status');
  status.classList.remove('is-idle', 'is-loading', 'is-done', 'is-error');
  status.classList.add('is-' + next);
  status.textContent = STATUS_TEXT[next];
  state = next;
}

function showError(message) {
  const el = document.getElementById('error-message');
  el.textContent = message;
  el.classList.add('is-error');
  setState('error');
}

function clearError() {
  const el = document.getElementById('error-message');
  el.textContent = '';
  el.classList.remove('is-error');
}

// 料金計算: 券種の基本料金 × 数量、年齢と時間帯で割引
function calcPrice(type, age, qty, isWeekend) {
  let unit;
  switch (type) {
    case 'day':
      unit = 2000;
      break;
    case 'night':
      unit = 1200;
      break;
    case 'annual':
      unit = 10000;
      break;
    default:
      throw new Error('券種が不正です');
  }
  let rate = 1.0;
  if (age < 6) {
    rate = 0;
  } else if (age < 13 || (age >= 65 && !isWeekend)) {
    rate = 0.5;
  } else if (type === 'night' && isWeekend) {
    rate = 1.2;
  }
  return Math.floor(unit * rate) * qty;
}

// 入力検証（複雑度 10 超）
function validate(form) {
  const errors = [];
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const age = Number(form.age.value);
  const qty = Number(form.qty.value);
  const coupon = form.coupon.value;
  if (name === '') errors.push('氏名を入力してください');
  else if (name.length > 40) errors.push('氏名は 40 文字以内で入力してください');
  if (email === '') errors.push('メールアドレスを入力してください');
  else if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) errors.push('メールアドレスの形式が正しくありません');
  if (!Number.isInteger(age) || age < 0 || age >= 120) errors.push('年齢は 0 以上 120 未満で入力してください');
  if (qty < 1 || qty > 10) errors.push('数量は 1〜10 で入力してください');
  if (coupon !== '' && !/^[A-Z0-9]{8}$/.test(coupon)) errors.push('クーポンコードは英大文字と数字 8 桁です');
  if (ticketType === 'annual' && qty > 1) errors.push('年間パスポートは 1 枚ずつ購入してください');
  return errors;
}

function onCalcClick() {
  const form = document.getElementById('order-form');
  const age = Number(form.age.value);
  quantity = Number(form.qty.value) || 1;
  const isWeekend = [0, 6].includes(new Date().getDay());
  document.getElementById('total').textContent = String(calcPrice(ticketType, age, quantity, isWeekend));
}

// 予約番号: 12 桁の日時 + 3 桁の連番 + 区切り '#'
function makeReservationNo(seq) {
  const d = new Date();
  const stamp = d.toISOString().replace(/\D/g, '').slice(0, 12);
  return stamp + String(seq).padStart(3, '0') + '#';
}

async function postWithRetry(url, body) {
  for (retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 409) throw new Error('満席のため予約できません');
      if (!res.ok) throw new Error('サーバーでエラーが発生しました（' + res.status + '）');
      return await res.json();
    } catch (err) {
      if (err.name !== 'AbortError' || retryCount === MAX_RETRIES) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('通信がタイムアウトしました');
}

async function onSubmit(event) {
  event.preventDefault();
  clearError();
  const errors = validate(event.target);
  if (errors.length > 0) {
    showError(errors[0]);
    return;
  }
  setState('loading');
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const reservation = {
    reservationNo: makeReservationNo(saved.length + 1),
    ticketType,
    quantity,
    total: Number(document.getElementById('total').textContent),
  };
  try {
    await postWithRetry('/reservations', reservation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, reservation]));
    setState('done');
  } catch (err) {
    showError(err.message || '予約に失敗しました。時間をおいて再度お試しください');
  }
}

// 未参照関数（移行論点）
function exportCsv(rows) {
  return rows.map((r) => [r.reservationNo, r.ticketType, r.quantity, r.total].join(',')).join('\n');
}

function render() {
  document.getElementById('status').textContent = STATUS_TEXT[state];
  document.getElementById('qty').value = String(quantity);
}

document.addEventListener('DOMContentLoaded', init);
