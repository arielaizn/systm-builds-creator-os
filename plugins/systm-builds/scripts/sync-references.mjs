#!/usr/bin/env node
// Skills carry their own copy of the references they use, so a skills-only install is self-contained.
// references/ is the source of truth: run this after editing it. `--check` fails if a copy drifted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
let drift = 0;
for (const skill of fs.readdirSync(path.join(root, 'skills'))) {
  const dir = path.join(root, 'skills', skill, 'references');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const src = path.join(root, 'references', f);
    const dst = path.join(dir, f);
    if (!fs.existsSync(src)) { console.error(`no canonical copy of ${f}`); drift++; continue; }
    const same = fs.readFileSync(src, 'utf8') === fs.readFileSync(dst, 'utf8');
    if (same) continue;
    if (check) { console.error(`drift: skills/${skill}/references/${f}`); drift++; } else { fs.copyFileSync(src, dst); console.log(`synced skills/${skill}/references/${f}`); }
  }
}
process.exitCode = drift ? 1 : 0;
