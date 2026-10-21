import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLI = path.join(ROOT, 'scripts', 'systm.mjs');
const SAMPLE = path.join(ROOT, 'examples', 'workspace');

export function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export function tmpSample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'systm-test-'));
  copyDir(SAMPLE, dir);
  return {
    dir,
    ep: path.join(dir, 'systm', 'episodes', 'EP001'),
    read(rel) { return JSON.parse(fs.readFileSync(path.join(this.ep, rel), 'utf8')); },
    write(rel, obj) { fs.mkdirSync(path.dirname(path.join(this.ep, rel)), { recursive: true }); fs.writeFileSync(path.join(this.ep, rel), JSON.stringify(obj, null, 2) + '\n'); },
    edit(rel, fn) { const o = this.read(rel); fn(o); this.write(rel, o); },
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

export function cli(args, root) {
  const r = spawnSync(process.execPath, [CLI, ...args, ...(root ? ['--root', root] : [])], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
