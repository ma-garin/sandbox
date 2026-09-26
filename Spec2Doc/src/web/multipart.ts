// multipart/form-data を自前で読む（依存を増やさない）。本文は上限つきでメモリに読む。

import type { IncomingMessage } from 'node:http';

export interface MultipartFile {
  field: string;
  filename: string;
  data: Buffer;
}

export interface MultipartResult {
  fields: ReadonlyMap<string, readonly string[]>;
  files: readonly MultipartFile[];
}

export class BodyTooLargeError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`送信サイズが上限（${Math.floor(limit / 1024 / 1024)} MB）を超えています`);
    this.name = 'BodyTooLargeError';
    this.limit = limit;
  }
}

export class MultipartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultipartError';
  }
}

export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new BodyTooLargeError(limit);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limit) throw new BodyTooLargeError(limit);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export function boundaryOf(contentType: string | undefined): string | undefined {
  const m = /^multipart\/form-data\s*;.*?boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType ?? '');
  return m?.[1] ?? m?.[2];
}

interface Part {
  name: string;
  filename?: string;
  data: Buffer;
}

function parsePart(part: Buffer): Part | undefined {
  const headerEnd = part.indexOf('\r\n\r\n');
  if (headerEnd < 0) throw new MultipartError('multipart の部分にヘッダーの終わりがありません');
  const headers = part.subarray(0, headerEnd).toString('utf8');
  const disposition = /content-disposition:[^\r\n]*/i.exec(headers)?.[0] ?? '';
  const name = /;\s*name="([^"]*)"/i.exec(disposition)?.[1];
  if (name === undefined) return undefined;
  const filename = /;\s*filename="([^"]*)"/i.exec(disposition)?.[1];
  return { name, data: Buffer.from(part.subarray(headerEnd + 4)), ...(filename !== undefined ? { filename } : {}) };
}

export function parseMultipart(body: Buffer, boundary: string): MultipartResult {
  const delim = Buffer.from(`--${boundary}`);
  const parts: Part[] = [];
  let pos = body.indexOf(delim);
  if (pos < 0) throw new MultipartError('multipart の区切りが見つかりません');
  for (;;) {
    pos += delim.length;
    if (body.subarray(pos, pos + 2).toString() === '--') break;
    const start = pos + 2; // 区切りの後の CRLF
    const next = body.indexOf(delim, start);
    if (next < 0) throw new MultipartError('multipart が途中で終わっています');
    const part = parsePart(body.subarray(start, next - 2)); // 区切りの前の CRLF を除く
    if (part) parts.push(part);
    pos = next;
  }
  const fields = new Map<string, readonly string[]>();
  for (const p of parts.filter((x) => x.filename === undefined)) {
    fields.set(p.name, [...(fields.get(p.name) ?? []), p.data.toString('utf8')]);
  }
  const files = parts
    .filter((x) => x.filename !== undefined && x.filename !== '')
    .map((x) => ({ field: x.name, filename: x.filename ?? '', data: x.data }));
  return { fields, files };
}
