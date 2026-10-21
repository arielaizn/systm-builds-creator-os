import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validate } from '../scripts/lib/schema.mjs';
import { lintText } from '../scripts/lib/he.mjs';
import { computeTiming, splitCaptions, buildCaptions } from '../scripts/lib/timing.mjs';
import { DEFAULT_CONFIG } from '../scripts/lib/model.mjs';
import { rankHooks, hookIssues, maatpaIssues } from '../scripts/lib/stages.mjs';
import { analyze, wilson } from '../scripts/lib/analytics.mjs';
import { parseCsv, toCsv } from '../scripts/lib/csv.mjs';
import { productGate } from '../scripts/lib/launch.mjs';
import { tmpSample, ROOT } from './helpers.mjs';

const cfg = DEFAULT_CONFIG;
const codes = (t, o) => lintText(t, o).map((f) => f.code);

test('schema validator: required, enum, pattern, items', () => {
  const s = { type: 'object', required: ['a', 'b'], properties: { a: { enum: ['x', 'y'] }, b: { type: 'array', minItems: 2, items: { type: 'string', pattern: '^E\\d+$' } } } };
  assert.equal(validate(s, { a: 'x', b: ['E1', 'E2'] }).length, 0);
  const e = validate(s, { a: 'z', b: ['E1', 'bad'] });
  assert.deepEqual(e.map((x) => x.path).sort(), ['/a', '/b/1']);
  assert.equal(validate(s, { a: 'x' }).some((x) => x.path === '/b'), true);
});

test('csv round trip keeps commas, quotes and Hebrew', () => {
  const text = toCsv(['a', 'b'], [{ a: 'שלום, עולם', b: 'say "hi"' }]);
  assert.deepEqual(parseCsv(text), [{ a: 'שלום, עולם', b: 'say "hi"' }]);
});

test('lint catches the structural AI tells', () => {
  assert.ok(codes('זה לא רק כלי אלא גם שיטה').includes('NEG_PARALLEL'));
  assert.ok(codes('זה לא כלי, זה שינוי').includes('NEG_PARALLEL'));
  assert.ok(codes('אין כאן בעיה. יש כאן הזדמנות').includes('NEG_PARALLEL'));
  assert.ok(codes('הכלי חוסך זמן — וגם כסף').includes('EM_DASH_SPACED'));
  assert.ok(codes('הוא מהווה פתרון').includes('BANNED_PHRASE'));
  assert.ok(codes('בוא נצלול פנימה').includes('TEMPLATE_OPENER') || codes('בוא נצלול פנימה').includes('BANNED_PHRASE'));
  assert.ok(codes('עבדנו קשה.\nלסיכום, זה עובד').includes('SUMMARY_CLOSER'));
  assert.ok(codes('שלום חברים, היום נבנה כלי', { hook: true }).includes('HOOK_GREETING'));
  assert.ok(codes('SYSTM BUILDS מציג כלי', { hook: true }).includes('HOOK_BUMPER'));
});

test('lint leaves normal spoken Hebrew alone', () => {
  const clean = 'המערכת הזאת מצאה לידים שאף אחד לא חזר אליהם. אתם מבקשים. אני בונה. כולם מקבלים, כשזה מוכן.';
  assert.deepEqual(lintText(clean, { hook: true }), []);
  assert.deepEqual(lintText('מעכ״ה וגם מעטפ״ה עם גרשיים עבריים'), []);
});

test('captions respect line limits and cover the whole speech window', () => {
  const s = tmpSample();
  try {
    const script = s.read('script.json');
    const timing = computeTiming(script, cfg);
    const cues = buildCaptions(script, timing, cfg);
    for (const c of cues) {
      assert.ok(c.lines.length <= cfg.captions.max_lines);
      for (const l of c.lines) assert.ok(l.length <= cfg.captions.max_chars_per_line, `line too long: ${l}`);
      assert.ok(c.end_s > c.start_s);
    }
    for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start_s >= cues[i - 1].end_s - 0.001, 'cues overlap');
    // fits a single long beat into balanced cues without a one-word widow
    const parts = splitCaptions('תזכורות ידניות תלויות בזיכרון של מי שיושב ליד המחשב.', cfg);
    assert.ok(parts.every((p) => p.words >= 3), JSON.stringify(parts));
  } finally { s.cleanup(); }
});

test('timing: frames are contiguous and total matches the last frame', () => {
  const s = tmpSample();
  try {
    const t = computeTiming(s.read('script.json'), cfg);
    for (let i = 1; i < t.beats.length; i++) assert.equal(t.beats[i].start_frame, t.beats[i - 1].end_frame);
    assert.equal(t.beats.at(-1).end_frame, t.total_frames);
    assert.equal(t.beats.length, 13);
  } finally { s.cleanup(); }
});

test('timing: calibration from a real recording replaces the estimate', () => {
  const s = tmpSample();
  try {
    const script = s.read('script.json');
    script.calibration = { vo_seconds: 70, words: 165, wps: 2.2 };
    const t = computeTiming(script, cfg);
    assert.equal(t.wps_source, 'calibrated_from_recording');
    assert.ok(t.total_s > computeTiming(s.read('script.json'), cfg).total_s);
  } finally { s.cleanup(); }
});

test('hooks: ranking is deterministic and unprovable selection is an error', () => {
  const s = tmpSample();
  try {
    const doc = s.read('hooks.json');
    const input = s.read('input.json');
    rankHooks(doc);
    assert.equal(doc.hooks.filter((h) => h.rank === 1).length, 1);
    assert.equal(hookIssues(doc, input, cfg).filter((i) => i.severity === 'error').length, 0);
    doc.selected = 'H02';
    const errs = hookIssues(doc, input, cfg).filter((i) => i.severity === 'error').map((i) => i.code);
    assert.ok(errs.includes('HOOK_UNPROVABLE'));
    assert.ok(errs.includes('HOOK_NO_EVIDENCE'));
  } finally { s.cleanup(); }
});

test('maatpa: an axis under 3 and an unknown novelty key are errors', () => {
  const s = tmpSample();
  try {
    const doc = s.read('maatpa.json');
    assert.equal(maatpaIssues(doc).length, 0);
    doc.axes.sound.score = 2;
    doc.novel_element.key = 'made_up_thing';
    const c = maatpaIssues(doc).map((i) => i.code);
    assert.ok(c.includes('AXIS_BELOW_3') && c.includes('NOVELTY_UNKNOWN'));
    doc.novel_element.key = 'custom:my_own';
    assert.ok(!maatpaIssues(doc).map((i) => i.code).includes('NOVELTY_UNKNOWN'));
  } finally { s.cleanup(); }
});

test('release gate: complete product opens, each gap blocks', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'gate-'));
  fs.writeFileSync(path.join(dir, 'shot.png'), 'x');
  const input = { status: 'BUILT', hosted_url: 'https://app.followup-demo.dev', repo_url: 'https://github.com/acme-co/tool' };
  const full = { name: 'x', status: 'BUILT', version: '1.0.0', capabilities: ['a'], hosted_url: input.hosted_url, hosted_url_tested: { tested_on: '2026-01-01', tested_by: 'Dana' }, repo_url: input.repo_url, repo_url_tested: { tested_on: '2026-01-01', tested_by: 'Dana' }, license: 'MIT', install: 'npm i', quotas: '100 per day', costs: { hosting: 'free tier', api: 'my key', third_party: 'none' }, privacy: 'no data stored', known_issues: ['slow on 10k rows'], support: 'issues page', screenshots: ['shot.png'], free_forever_claim: false };
  try {
    assert.equal(productGate(full, input, dir).verdict, 'OPEN');
    for (const [k, v] of [['license', null], ['hosted_url', null], ['quotas', ''], ['known_issues', []], ['screenshots', ['nope.png']], ['install', 'TODO']]) {
      assert.equal(productGate({ ...full, [k]: v }, input, dir).verdict, 'BLOCKED', k);
    }
    assert.equal(productGate({ ...full, free_forever_claim: true }, input, dir).verdict, 'BLOCKED');
    assert.equal(productGate(full, { ...input, status: 'PROTOTYPE' }, dir).verdict, 'BLOCKED');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('analytics: Wilson interval, data issues and the synthetic label', () => {
  const w = wilson(50, 100);
  assert.ok(Math.abs(w.lo - 0.4038) < 0.001 && Math.abs(w.hi - 0.5962) < 0.001);
  const bad = analyze('date,platform,episode_id,views,visits,activations,consultations\n2026-01-01,instagram,EP001,100,500,5,0\n');
  assert.ok(bad.data_issues.some((i) => /visits.*exceed views/.test(i)));
  const ok = analyze('date,platform,episode_id,views,visits,activations,consultations\n2026-01-01,instagram,EP001,1000,100,10,1\n', { synthetic: true });
  assert.equal(ok.label, 'SYNTHETIC');
  assert.equal(ok.total.activations_per_1000_views, 10);
  assert.ok(ok.notes.some((n) => /never quote/.test(n)));
  assert.ok(ok.notes.some((n) => /No causal claims/.test(n)));
});

test('the engine contains no code that writes to a remote service', () => {
  const dir = path.join(ROOT, 'scripts');
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.mjs') && files.push(p); } };
  walk(dir);
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(t), `${f} has a write method`);
    assert.ok(!/from ['"]node:(http|https|net|tls)['"]/.test(t), `${f} imports a raw network module`);
    if (/fetch\(/.test(t)) {
      assert.ok(f.endsWith('launch.mjs'), `${f} uses fetch outside the URL check`);
      const methods = [...t.matchAll(/hit\(url, '([A-Z]+)'\)/g)].map((m) => m[1]);
      assert.ok(methods.length > 0 && methods.every((m) => ['HEAD', 'GET'].includes(m)), `URL check may only HEAD or GET, found ${methods}`);
    }
  }
});
