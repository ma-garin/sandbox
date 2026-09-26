// 共通の入力検証。ログイン・検索・貸出・返却の 4 画面から呼ばれる
export const MEMBER_ID_PATTERN = /^M\d{6}$/;
export const ISBN_PATTERN = /^\d{13}$/;
export const LOAN_ID_PATTERN = /^L\d{8}$/;
export const QUERY_MIN = 1;
export const QUERY_MAX = 50;
export const LOAN_COUNT_MIN = 1;
export const LOAN_COUNT_MAX = 5;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 32;

export function validateMemberId(value) {
  const v = String(value ?? '').trim();
  if (v === '') return '会員番号を入力してください';
  if (!MEMBER_ID_PATTERN.test(v)) return '会員番号は M と数字 6 桁で入力してください';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (v.length < 8) return 'パスワードは 8 文字以上で入力してください';
  if (v.length > 32) return 'パスワードは 32 文字以内で入力してください';
  return null;
}

export function validateIsbn(value) {
  const v = String(value ?? '').replace(/-/g, '');
  if (!ISBN_PATTERN.test(v)) return 'ISBN は数字 13 桁で入力してください';
  if (!isbnCheckDigitOk(v)) return 'ISBN のチェックディジットが正しくありません';
  return null;
}

function isbnCheckDigitOk(isbn) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

export function validateQuery(value) {
  const v = String(value ?? '').trim();
  if (v.length < 1) return '検索語を入力してください';
  if (v.length > 50) return '検索語は 50 文字以内で入力してください';
  return null;
}

export function validateLoanCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return '冊数は整数で入力してください';
  if (n < 1 || n > 5) return '一度に借りられるのは 1〜5 冊です';
  return null;
}

export function validateLoanId(value) {
  const v = String(value ?? '').trim();
  if (!LOAN_ID_PATTERN.test(v)) return '貸出番号は L と数字 8 桁で入力してください';
  return null;
}

export function collectErrors(checks) {
  return checks.filter((msg) => msg !== null);
}
