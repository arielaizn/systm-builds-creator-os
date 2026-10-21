import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const which = (cmd, args = ['--version']) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr).split('\n')[0].trim();
};

export function doctor(ws, pluginRoot) {
  const out = [];
  const add = (id, status, msg, fix) => out.push({ id, status, msg, ...(fix && status !== 'PASS' ? { fix } : {}) });
  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 20 ? 'PASS' : 'FAIL', `node ${process.versions.node}`, major >= 20 ? undefined : 'install Node 20 or newer');
  for (const [id, cmd] of [['claude', 'claude'], ['codex', 'codex'], ['openclaw', 'openclaw']]) {
    const v = which(cmd);
    add(`agent_${id}`, v ? 'PASS' : 'INFO', v ? `${cmd}: ${v}` : `${cmd} not found (only needed if you use that agent)`);
  }
  const ff = which('ffmpeg', ['-version']);
  const fp = which('ffprobe', ['-version']);
  add('ffmpeg', ff && fp ? 'PASS' : 'WARN', ff && fp ? ff : 'ffmpeg/ffprobe missing: `systm qa-media` and frame export will not run', 'brew install ffmpeg');
  if (ff) {
    const filters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout ?? '';
    const lib = spawnSync('ffmpeg', ['-hide_banner', '-buildconf'], { encoding: 'utf8' }).stdout ?? '';
    add('ffmpeg_subtitles', /\bsubtitles\b/.test(filters) ? 'PASS' : 'WARN', /\bsubtitles\b/.test(filters) ? 'subtitles filter (libass) present: burned-in Hebrew captions possible' : 'no libass: you cannot burn captions with ffmpeg here, use the editor or Remotion for captions');
    add('ffmpeg_loudnorm', /loudnorm/.test(filters) ? 'PASS' : 'WARN', /loudnorm/.test(filters) ? 'loudnorm present' : 'loudnorm missing: no LUFS check');
    add('ffmpeg_fribidi', /enable-libfribidi/.test(lib) ? 'PASS' : 'INFO', /enable-libfribidi/.test(lib) ? 'libfribidi present (RTL shaping in libass)' : 'no libfribidi in this ffmpeg build: check any burned-in Hebrew on a rendered frame');
  }
  // Hebrew-capable fonts
  let fonts = [];
  const fc = spawnSync('fc-list', [':lang=he', 'family'], { encoding: 'utf8' });
  if (fc.status === 0) fonts = [...new Set(fc.stdout.split('\n').map((l) => l.split(',')[0].trim()).filter(Boolean))];
  else if (process.platform === 'darwin') {
    const dirs = ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')];
    for (const d of dirs) if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/(hebrew|heebo|assistant|rubik|arial|helvetica|noto)/i.test(f)) fonts.push(f);
  }
  add('hebrew_fonts', fonts.length ? 'PASS' : 'WARN', fonts.length ? `${fonts.length} Hebrew-capable fonts, e.g. ${fonts.slice(0, 4).join(', ')}` : 'no Hebrew-capable font detected: install Heebo, Assistant or Rubik for the video text');
  const rem = which('remotion', ['versions']) ?? (fs.existsSync(path.join(ws.base, 'node_modules', 'remotion')) ? 'remotion in node_modules' : null);
  add('remotion', rem ? 'PASS' : 'INFO', rem ? `remotion: ${rem}` : 'Remotion not installed (optional, M4). The motion props work with any frame-driven renderer');
  try { fs.accessSync(ws.base, fs.constants.W_OK); add('workspace_writable', 'PASS', `workspace ${ws.base} is writable`); } catch { add('workspace_writable', 'FAIL', `${ws.base} is not writable`); }
  const df = spawnSync('df', ['-k', ws.base], { encoding: 'utf8' });
  if (df.status === 0) {
    const cols = df.stdout.trim().split('\n').pop().split(/\s+/);
    const freeGb = Number(cols[3]) / 1024 / 1024;
    add('disk', freeGb >= 5 ? 'PASS' : 'WARN', `${freeGb.toFixed(1)} GB free`, freeGb >= 5 ? undefined : 'renders and screen recordings need room: free some space first');
  }
  const gi = path.join(ws.base, '.gitignore');
  const envTracked = fs.existsSync(path.join(ws.base, '.env'));
  add('secrets', envTracked && !(fs.existsSync(gi) && /(^|\n)\.env/.test(fs.readFileSync(gi, 'utf8'))) ? 'WARN' : 'PASS', envTracked ? '.env present: make sure it is in .gitignore' : 'no .env in the workspace root');
  add('plugin_root', fs.existsSync(path.join(pluginRoot, 'schemas')) ? 'PASS' : 'FAIL', `plugin root ${pluginRoot}`);
  const rank = { FAIL: 3, WARN: 1, PASS: 0, INFO: 0 };
  return { verdict: out.reduce((w, c) => (rank[c.status] > rank[w] ? c.status : w), 'PASS'), checks: out };
}
