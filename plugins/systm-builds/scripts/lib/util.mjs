import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '1.0.0';

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

// Hash of a stage file. JSON files hash without their provenance block so that
// stamping a file does not invalidate everything downstream of it.
export function contentHash(file) {
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file);
  if (file.endsWith('.json')) {
    try {
      const obj = JSON.parse(raw.toString('utf8'));
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const { provenance, ...rest } = obj;
        return sha256(canonical(rest));
      }
    } catch { /* fall through to raw hash */ }
  }
  return sha256(raw);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = text.endsWith('\n') ? text : text + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === body) return false;
  fs.writeFileSync(file, body);
  return true;
}

export function writeJson(file, obj) {
  return writeText(file, JSON.stringify(obj, null, 2));
}

export function exists(file) {
  return fs.existsSync(file);
}

export function words(text) {
  return String(text ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

export function wordCount(text) {
  return words(text).length;
}

export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

// seconds -> "HH:MM:SS,mmm" (srt) or "HH:MM:SS.mmm" (vtt)
export function timecode(sec, sep = ',') {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

export function mmss(sec) {
  const s = Math.round(sec);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export class CliError extends Error {
  constructor(message, code = 1, details) {
    super(message);
    this.exitCode = code;
    this.details = details;
  }
}

export function walk(dir, filter = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out.sort();
}
