// 送信前の伏字処理（REQ-N-008）。秘密情報らしき行は行ごと伏字にする。値そのものは返り値にもログにも残さない。

export const REDACTED_LINE = '[秘密情報の可能性があるため伏字]';

const SECRET_LINE_PATTERNS: readonly RegExp[] = [
  // 代入・キー値: api_key = ..., "password": ..., token: ...
  /(api[_-]?key|apikey|secret|token|passw(or)?d|passwd|pwd|credential|private[_-]?key|access[_-]?key|client[_-]?secret|auth(orization)?)["']?\s*[:=]/i,
  // Authorization ヘッダの値
  /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/i,
  // 資格情報付きの接続文字列: scheme://user:pass@host
  /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i,
  // 接続文字列の Password=…; 形式
  /(password|pwd)\s*=\s*[^;\s]+/i,
  // よく知られた鍵の形
  /\b(sk-(ant-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // JWT
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

/** .env 由来（.env・.env.local 等）のファイルか。これらは断片ごと送らない */
export function isEnvFile(file: string): boolean {
  const base = file.split('/').pop() ?? file;
  return /^\.env(\..+)?$/i.test(base) && !/\.(example|sample|template)$/i.test(base);
}

export function isSecretLine(line: string): boolean {
  return SECRET_LINE_PATTERNS.some((re) => re.test(line));
}

export interface RedactResult {
  text: string;
  redactedLines: number;
}

/** 秘密情報らしき行を字下げを残して伏字に置き換えた新しい文字列を返す */
export function redact(text: string): RedactResult {
  let redactedLines = 0;
  const lines = text.split(/(\r?\n)/).map((part, i) => {
    if (i % 2 === 1 || !isSecretLine(part)) return part;
    redactedLines++;
    const indent = /^\s*/.exec(part)?.[0] ?? '';
    return `${indent}${REDACTED_LINE}`;
  });
  return { text: lines.join(''), redactedLines };
}
