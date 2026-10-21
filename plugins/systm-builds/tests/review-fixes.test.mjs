import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workspace } from '../scripts/lib/episode.mjs';
import { runChecks } from '../scripts/lib/verify.mjs';
import { cmdBuild, cmdDistribute } from '../scripts/lib/commands.mjs';
import { claimHits, giveawayOffenders, impliesRequest } from '../scripts/lib/scan.mjs';
import { lintText } from '../scripts/lib/he.mjs';
import { productGate, httpsUrl } from '../scripts/lib/launch.mjs';
import { analyze } from '../scripts/lib/analytics.mjs';
import { cli, tmpSample } from './helpers.mjs';

const run = (s, stage = 'plan') => { const ws = workspace(s.dir); cmdBuild(ws, 'EP001'); return runChecks(ws, 'EP001', { stage }); };
const get = (rep, id) => rep.checks.find((c) => c.id === id);
const withSample = (fn) => () => { const s = tmpSample(); try { fn(s); } finally { s.cleanup(); } };
const types = (t) => claimHits(t).map((h) => h.type);

test('giveaway promises are caught in every beat, overlay and caption, not just beat 13', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[11].vo = 'תורידו בחינם את הקוד מהגיטהאב.'; });
  assert.match(get(run(s), 'V11').details.join(' '), /beat 12 vo promises access/);
  s.edit('script.json', (o) => { o.beats[11].vo = 'יש תנאי.'; o.beats[7].on_screen_text = 'הורדה בחינם'; });
  assert.match(get(run(s), 'V11').details.join(' '), /beat 8 overlay promises access/);
  s.edit('script.json', (o) => { o.beats[7].on_screen_text = 'SYSTM FOLLOWUP'; o.beats[3].shots = [{ mode: 'A-CAM', overlay: 'הלינק בביו' }]; });
  assert.match(get(run(s), 'V11').details.join(' '), /shot 1 overlay promises access/);
}));

test('softeners are real "not yet" markers: ללא, מלא and אין צורך do not disarm the check', () => {
  for (const t of ['הכלי בחינם, ללא הרשמה.', 'הורדה בחינם, אין צורך בכרטיס אשראי.', 'הכלי מלא בפיצ\'רים וזמין להורדה.', 'הורידו אותו עכשיו.', 'הלינק בביו', 'כתבו FOLLOWUP ואני שולח לכם', 'תורידו מהלינק בפרופיל.']) {
    assert.ok(giveawayOffenders(t).length > 0, t);
  }
  for (const t of ['עדיין אין קישור להורדה.', 'כולם מקבלים, כשזה מוכן.', 'בקרוב, אחרי שזה נבדק.', 'איזה כלי לבנות אחרי זה?']) assert.equal(giveawayOffenders(t).length, 0, t);
  assert.equal(giveawayOffenders('הקוד נמצא ב-github.com/acme/tool.git ואין לו עדיין רישיון').length, 0);
});

test('distribution copy is claim-checked and giveaway-checked', withSample((s) => {
  const ws = workspace(s.dir);
  s.edit('distribution.json', (o) => { o.platforms.linkedin.caption = 'חסכנו 300 שעות עבודה, מאות לקוחות מרוצים. אחד הלקוחות שלי אמר לי שזה עובד.'; o.thumbnail_text = 'פי 5 לידים'; });
  const r = cmdDistribute(ws, 'EP001');
  assert.equal(r.exit, 1);
  const out = r.lines.join('\n');
  for (const type of ['time_saved', 'social_proof', 'customer', 'quote', 'roi']) assert.match(out, new RegExp(`\\(${type}\\)`), type);
  assert.equal(get(run(s), 'V09').status, 'FAIL');
  s.edit('distribution.json', (o) => { o.platforms.linkedin.caption = 'הכלי בחינם, ללא הרשמה. הלינק בביו.'; o.thumbnail_text = 'ליד כפול'; });
  assert.match(cmdDistribute(ws, 'EP001').lines.join('\n'), /offers access while the release gate is blocked/);
}));

test('on-screen text inside shots[].overlay is claim-checked, linted, length-checked and label-checked', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[4].shots = [{ mode: 'MOTION', overlay: 'חסכנו 40 שעות בשבוע, 300% ROI' }, { mode: 'MOTION', overlay: 'מאות לקוחות מרוצים' }]; });
  const rep = run(s);
  const d = get(rep, 'V09').details.join(' ');
  assert.equal(get(rep, 'V09').status, 'FAIL');
  assert.match(d, /shot 1 overlay/);
  assert.match(d, /\(social_proof\)/);
}));

test('claim triggers catch easy rewordings (reviewer repro list)', () => {
  const expect = {
    time_saved: ['זה חסך לנו שעות', 'קיצר שלושים דקות', 'חצי שעה פחות', 'שעה שלמה בחזרה'],
    roi: ['פי שלוש', 'שלושים אחוז', 'הכנסתי אלף שקל', '50 ש״ח', '1,000 שקלים'],
    social_proof: ['מיליוני משתמשים', 'אלפי אנשים', '10,000 משתמשים', 'מעל מאה לקוחות'],
    customer: ['לקוח שלי אמר', 'הלקוחות שלנו מרוצים'],
    built: ['הקמנו את זה', 'יצרתי כלי', 'הכלי עובד אצל לקוחות'],
    quote: ['אמרו לי', 'שלחו לי הודעה', 'הגיבו לי'],
  };
  for (const [type, list] of Object.entries(expect)) for (const t of list) assert.ok(types(t).includes(type), `${t} should be ${type}, got ${types(t)}`);
});

test('claim triggers leave innocent text alone', () => {
  for (const t of ['קוראים לזה "SYSTM FOLLOWUP"', 'המנכ"ל של חברה בע"מ', 'מספר 13', 'כמה ימים לקח לבנות', 'הדגמה של שלוש דקות', 'אתם מבקשים. אני בונה. כולם מקבלים.', 'המערכת הזאת מצאה לידים שאף אחד לא חזר אליהם.']) assert.deepEqual(types(t), [], t);
});

test('origin check reads every beat and knows the negated honest sentence', () => {
  assert.equal(impliesRequest('אף אחד עוד לא ביקש, אז זו הצעה שלי'), false);
  assert.equal(impliesRequest('אתם מבקשים. אני בונה.'), false);
  for (const t of ['ביקשתם כלי ללידים', 'מישהו ביקש ממני כלי כזה', 'קיבלתי כמה בקשות', 'ביקשו ממני']) assert.equal(impliesRequest(t), true, t);
}); 

test('V10 flags a request implied in beat 1 when the origin is an observed need', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[1].vo = 'ביקשתם כלי ללידים, אז הנה הוא?'; });
  assert.match(get(run(s), 'V10').details.join(' '), /beat 2 vo implies someone asked/);
}));

test('V12: a sha256 that happens to contain a phone-shaped run is not a phone number', withSample((s) => {
  fs.writeFileSync(path.join(s.ep, 'notes.json'), JSON.stringify({ sha256: '05667363928f4ed8bfdbd57753903297f245561550ca49f0f162d54d961580ad' }));
  assert.equal(get(run(s), 'V12').status, 'PASS');
  fs.writeFileSync(path.join(s.ep, 'notes.json'), 'call 052-3456789 now');
  assert.equal(get(run(s), 'V12').status, 'FAIL');
}));

test('launch gate rejects placeholders, fake hosts, unknown licences, junk test records and folders as screenshots', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'gate2-'));
  fs.writeFileSync(path.join(dir, 's.png'), 'x');
  fs.mkdirSync(path.join(dir, 'folder'));
  const input = { status: 'BUILT', hosted_url: 'https://app.followup-demo.dev', repo_url: 'https://github.com/acme-co/tool' };
  const ok = { name: 'x', status: 'BUILT', version: '1.0.0', capabilities: ['a'], hosted_url: input.hosted_url, hosted_url_tested: { tested_on: '2026-02-01', tested_by: 'Dana' }, repo_url: input.repo_url, repo_url_tested: { tested_on: '2026-02-01', tested_by: 'Dana' }, license: 'AGPL-3.0-only', install: 'npm i todolist', quotas: 'q', costs: { hosting: 'h', api: 'a', third_party: 't' }, privacy: 'p', known_issues: ['i'], support: 's', screenshots: ['s.png'] };
  try {
    assert.equal(productGate(ok, input, dir).verdict, 'OPEN', 'a word like todolist must not block');
    const bad = (patch, inputPatch = {}) => productGate({ ...ok, ...patch }, { ...input, ...inputPatch }, dir).verdict === 'BLOCKED';
    assert.ok(bad({ license: 'All rights reserved' }));
    assert.ok(bad({ hosted_url: 'https://x.y/[APP]' }, { hosted_url: 'https://x.y/[APP]' }));
    assert.ok(bad({ repo_url: 'https://github.com/OWNER/REPO' }, { repo_url: 'https://github.com/OWNER/REPO' }));
    assert.ok(bad({ hosted_url: 'https://followup.example.com' }, { hosted_url: 'https://followup.example.com' }));
    assert.ok(bad({ hosted_url_tested: { tested_on: 'x', tested_by: 'y' } }));
    assert.ok(bad({ repo_url_tested: { tested_on: '2026-02-01', tested_by: 'agent' } }));
    assert.ok(bad({ screenshots: ['folder'] }));
    assert.ok(bad({ screenshots: ['../escape.png'] }));
    assert.ok(bad({ install: 'TODO' }));
    assert.equal(httpsUrl('http://app.followup-demo.dev'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('evidence refs must be real captures: no self-reference, no folders, no escapes, no agent verifier', withSample((s) => {
  const mark = (patch) => s.edit('input.json', (o) => { Object.assign(o.evidence[0], { state: 'verified', verified_by: 'Dana' }, patch); });
  mark({ ref: 'input.json' });
  assert.match(get(run(s, 'plan'), 'V09').details.join(' '), /pipeline file/);
  mark({ ref: '../../../../package.json' });
  assert.match(get(run(s, 'plan'), 'V09').details.join(' '), /outside the systm\/ workspace/);
  fs.mkdirSync(path.join(s.ep, 'captures'));
  mark({ ref: 'captures' });
  assert.match(get(run(s, 'plan'), 'V09').details.join(' '), /missing, empty or a folder/);
  fs.writeFileSync(path.join(s.ep, 'captures', 'a.mov'), 'x');
  mark({ ref: 'captures/a.mov', verified_by: 'agent' });
  assert.match(get(run(s, 'plan'), 'V09').details.join(' '), /not a person/);
}));

test('V13: an approval recorded under an agent name fails', withSample((s) => {
  run(s);
  fs.writeFileSync(path.join(s.ep, 'approvals.json'), JSON.stringify({ schema: 'systm/approvals@1', episode_id: 'EP001', approvals: [{ action: 'post:instagram', content_sha256: 'x', approved_by: 'Claude' }] }));
  assert.equal(get(run(s), 'V13').status, 'FAIL');
  const r = cli(['approve', 'EP001', '--action', 'post:instagram', '--by', 'agent'], s.dir);
  assert.equal(r.code, 3);
}));

test('a calibration goes stale when the VO changes afterwards', withSample((s) => {
  assert.equal(cli(['script', 'EP001', '--calibrate-seconds', '66'], s.dir).code, 0);
  s.edit('script.json', (o) => { o.beats[4].vo = `${o.beats[4].vo} ${o.beats[4].vo} ${o.beats[4].vo}`; });
  const rep = run(s);
  assert.match(get(rep, 'V03').details.join(' '), /calibration is stale/);
  assert.equal(get(rep, 'V03').status, 'WARN');
}));

test('package: an honest coming-soon episode can be ready, an unverified giveaway cannot', withSample((s) => {
  s.write('qa/media.json', { schema: 'systm/media-qa@1', episode_id: 'EP001', file: 'a.mp4', verdict: 'PASS', duration_s: 64, checks: [] });
  cli(['script', 'EP001', '--calibrate-seconds', '64'], s.dir);
  cli(['build', 'EP001'], s.dir);
  cli(['verify', 'EP001'], s.dir);
  const r = cli(['package', 'EP001'], s.dir);
  const m = s.read('package/manifest.json');
  assert.equal(m.cta, 'coming_soon');
  assert.equal(m.release_gate, 'BLOCKED');
  assert.ok(!m.blocked_by.some((x) => /giveaway|gate/i.test(x)), JSON.stringify(m.blocked_by));
  assert.ok(m.blocked_by.every((x) => /release|V09|evidence|verified/i.test(x)), `only the unverified evidence should block: ${JSON.stringify(m.blocked_by)}`);
}));

test('script exits 1 and marks needs_revision when the VO fails the voice lint', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[3].vo = 'זה לא כלי, זה שינוי.'; });
  const r = cli(['script', 'EP001'], s.dir);
  assert.equal(r.code, 1);
  assert.equal(s.read('script.json').status, 'needs_revision');
}));

test('lint: prefixed banned words, new parallelism shapes, and the false positive from review', () => {
  const c = (t) => lintText(t).map((f) => f.code);
  assert.ok(c('ומהווה פתרון').includes('BANNED_PHRASE'));
  assert.ok(c('ובשורה התחתונה זה עובד').includes('SUMMARY_CLOSER'));
  assert.ok(c('זה לא עוד כלי. זה מערכת.').includes('NEG_PARALLEL'));
  assert.ok(c('לא עוד כלי, אלא מערכת').includes('NEG_PARALLEL'));
  assert.ok(c('הבעיה היא לא הכלי אלא המעקב').includes('NEG_PARALLEL'));
  assert.deepEqual(c('הוא לא יציב, הוא גם איטי.'), []);
});

test('analytics: another episode\'s bad row does not fail this one, duplicates are skipped, bad rows are excluded', () => {
  const head = 'date,platform,episode_id,views,visits,activations,consultations\n';
  const a = analyze(head + '2026-01-01,instagram,EP001,1000,100,10,1\n2026-01-01,instagram,EP001,1000,100,10,1\n2026-01-01,instagram,EP002,10,500,5,0\n', { episode: 'EP001' });
  assert.equal(a.total.views, 1000);
  assert.ok(a.data_issues.some((i) => /duplicate/.test(i)));
  assert.ok(!a.data_issues.some((i) => /exceed views/.test(i)));
  const b = analyze(head + '2026-01-01,instagram,EP001,1000,100,10,1\n2026-01-02,tiktok,EP001,100,500,5,0\n', { episode: 'EP001' });
  assert.equal(b.total.views, 1000, 'the bad row must be excluded from totals');
  assert.equal(b.rows_excluded, 1);
});

test('argument parsing: boolean flags do not eat the next positional, missing values and files are friendly errors', withSample((s) => {
  assert.match(cli(['--json', 'status', 'EP001'], s.dir).out, /"lines"/);
  cli(['verify', 'EP001'], s.dir);
  assert.equal(cli(['package', '--zip', 'EP001'], s.dir).code, 0);
  const noval = cli(['status', 'EP001', '--root'], undefined);
  assert.equal(noval.code, 1);
  assert.match(noval.err, /--root needs a value/);
  const nofile = cli(['qa-media', '/nonexistent/video.mp4'], s.dir);
  assert.equal(nofile.code, 1);
  assert.match(nofile.err, /video file was not found/);
  assert.ok(!/at .*\.mjs:\d+/.test(nofile.err), 'no stack trace');
}));
