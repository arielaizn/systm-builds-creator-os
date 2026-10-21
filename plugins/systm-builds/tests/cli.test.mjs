import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, tmpSample, ROOT } from './helpers.mjs';
import { qaMedia, has } from '../scripts/lib/media.mjs';
import { DEFAULT_CONFIG } from '../scripts/lib/model.mjs';
import { pluginChecks, selfTest } from '../scripts/lib/commands.mjs';

const tmp = (p = 'systm-cli-') => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('init creates the workspace once and is safe to repeat', () => {
  const d = tmp();
  try {
    const a = cli(['init'], d);
    assert.equal(a.code, 0);
    for (const f of ['config.json', 'SHOW_BIBLE.md', 'series/requests.jsonl', 'series/backlog.json']) assert.ok(fs.existsSync(path.join(d, 'systm', f)), f);
    const b = cli(['init'], d);
    assert.match(b.out, /already initialised/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('new accepts the pack EPISODE_INPUT.json, including "observed need" with a space', () => {
  const d = tmp();
  try {
    cli(['init'], d);
    const r = cli(['new', 'EP001', '--from', path.join(ROOT, '..', '..', 'docs', 'original-spec', '07_TEMPLATES', 'EPISODE_INPUT.json')], d);
    assert.equal(r.code, 0, r.err);
    const input = JSON.parse(fs.readFileSync(path.join(d, 'systm', 'episodes', 'EP001', 'input.json'), 'utf8'));
    assert.equal(input.origin, 'observed_need');
    assert.equal(input.status, 'PROTOTYPE');
    assert.equal(input.hosted_url, null);
    assert.equal(cli(['new', 'EP001'], d).code, 1, 'must not overwrite');
    assert.equal(cli(['new', 'bad-id'], d).code, 1);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('scaffolds exist for every authored stage and unfilled ones are rejected', () => {
  const d = tmp();
  try {
    cli(['init'], d);
    cli(['new', 'EP002', '--product', 'x', '--audience', 'y', '--pain', 'z', '--keyword', 'k', '--novel', 'n'], d);
    for (const st of ['idea', 'hooks', 'maatpa', 'script', 'distribution', 'product']) assert.equal(cli(['scaffold', st, 'EP002'], d).code, 0, st);
    assert.equal(cli(['scaffold', 'idea', 'EP002'], d).code, 1, 'no overwrite');
    for (const st of ['idea', 'hooks', 'maatpa', 'script']) assert.equal(cli([st, 'EP002'], d).code, 1, `${st} should reject an empty scaffold`);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('requests ledger: no source_ref or no consent is called out, backlog prefers consented requests', () => {
  const d = tmp();
  try {
    cli(['init'], d);
    const a = cli(['request', 'add', '--text', 'תבנו כלי להצעות מחיר', '--channel', 'instagram_comment'], d);
    assert.match(a.out, /no --source-ref/);
    assert.match(a.out, /consent is not "obtained"/);
    cli(['request', 'add', '--text', 'כלי למעקב לידים', '--channel', 'form', '--source-ref', 'https://example.com/form/1', '--consent', 'obtained'], d);
    cli(['backlog', 'add', '--title', 'הצעות מחיר', '--request', 'R001', '--priority', '5'], d);
    cli(['backlog', 'add', '--title', 'מעקב לידים', '--request', 'R002', '--priority', '2'], d);
    cli(['backlog', 'add', '--title', 'תצפית חופשית', '--priority', '5'], d);
    const n = cli(['backlog', 'next'], d);
    assert.match(n.out, /B002/, n.out);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('approve refuses to run without a human at a terminal', () => {
  const s = tmpSample();
  try {
    const r = cli(['approve', 'EP001', '--action', 'post:instagram', '--by', 'someone'], s.dir);
    assert.equal(r.code, 3);
    assert.match(r.err, /interactive terminal/);
    assert.ok(!fs.existsSync(path.join(s.ep, 'approvals.json')));
  } finally { s.cleanup(); }
});

test('the full pipeline is idempotent: a second build changes nothing', () => {
  const s = tmpSample();
  try {
    const a = cli(['build', 'EP001'], s.dir);
    assert.match(a.out, /nothing changed/);
    const before = fs.readFileSync(path.join(s.ep, 'build', 'edl.csv'), 'utf8');
    cli(['script', 'EP001'], s.dir);
    cli(['build', 'EP001'], s.dir);
    assert.equal(fs.readFileSync(path.join(s.ep, 'build', 'edl.csv'), 'utf8'), before);
  } finally { s.cleanup(); }
});

test('editing an upstream file marks downstream stages stale', () => {
  const s = tmpSample();
  try {
    s.edit('script.json', (o) => { o.beats[1].vo = 'אבל אולי הבעיה היא שאין מי שאחראי על כל המעקב?'; });
    const r = cli(['status', 'EP001'], s.dir);
    assert.match(r.out, /stale\s+build/);
    assert.match(r.out, /next: systm build/);
  } finally { s.cleanup(); }
});

test('calibration from the recorded VO length rewrites the timing source', () => {
  const s = tmpSample();
  try {
    const r = cli(['script', 'EP001', '--calibrate-seconds', '68.4'], s.dir);
    assert.match(r.out, /calibrated: 165 words/);
    cli(['build', 'EP001'], s.dir);
    assert.equal(s.read('build/timing.json').wps_source, 'calibrated_from_recording');
  } finally { s.cleanup(); }
});

test('verify exit codes: FAIL is 1, clean is 0', () => {
  const s = tmpSample();
  try {
    assert.equal(cli(['verify', 'EP001'], s.dir).code, 0);
    s.edit('script.json', (o) => { o.beats[9].vo += ' זה חסך לנו שעות.'; });
    cli(['script', 'EP001'], s.dir);
    cli(['build', 'EP001'], s.dir);
    assert.equal(cli(['verify', 'EP001'], s.dir).code, 1);
  } finally { s.cleanup(); }
});

test('package zip is created and lists ready_to_publish=false for the planned sample', () => {
  const s = tmpSample();
  try {
    cli(['verify', 'EP001'], s.dir);
    const r = cli(['package', 'EP001', '--zip'], s.dir);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /ready_to_publish=false/);
    assert.ok(fs.existsSync(path.join(s.dir, 'systm', 'out', 'EP001-package.zip')) || fs.existsSync(path.join(s.dir, 'systm', 'out', 'EP001-package.tar.gz')));
  } finally { s.cleanup(); }
});

test('sample EP001 regenerates byte-identically from its authored files', () => {
  const r = selfTest(path.resolve(ROOT));
  assert.deepEqual(r.diffs, []);
  assert.ok(r.files >= 25);
});

test('plugin structure check passes (manifests agree, skills valid, marketplaces resolve)', () => {
  const c = pluginChecks(ROOT).find((x) => x.id === 'structure');
  assert.equal(c.status, 'PASS', c.msg);
});

test('media QA: a clean 1080x1920 clip passes format checks, a black clip fails', { skip: !has('ffmpeg') }, () => {
  const d = tmp('systm-media-');
  try {
    const good = path.join(d, 'good.mp4');
    const black = path.join(d, 'black.mp4');
    const mk = (out, src) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', src, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-t', '3', '-r', '30', '-pix_fmt', 'yuv420p', '-shortest', out], { encoding: 'utf8' });
    assert.equal(mk(good, 'testsrc2=size=1080x1920:rate=30:duration=3').status, 0);
    assert.equal(mk(black, 'color=c=black:size=1080x1920:rate=30:duration=3').status, 0);
    const g = qaMedia(good, DEFAULT_CONFIG);
    const byId = (r, id) => r.checks.find((c) => c.id === id)?.status;
    assert.equal(byId(g, 'M01'), 'PASS');
    assert.equal(byId(g, 'M02'), 'PASS');
    assert.equal(byId(g, 'M05'), 'PASS');
    assert.equal(byId(g, 'M03'), 'FAIL', 'a 3 second clip is outside 45-90s');
    assert.equal(byId(g, 'M06'), 'PASS');
    assert.equal(byId(qaMedia(black, DEFAULT_CONFIG), 'M06'), 'FAIL');
    const frames = qaMedia(good, DEFAULT_CONFIG, { framesDir: path.join(d, 'frames') });
    assert.equal(frames.frames.length, 13);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('skill reference copies match the canonical references/', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'sync-references.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('Hebrew docs in the repo pass the plugin\'s own voice lint (no errors)', async () => {
  const { lintText } = await import('../scripts/lib/he.mjs');
  const repo = path.resolve(ROOT, '..', '..');
  const files = [path.join(repo, 'README.md'), path.join(repo, 'docs', 'SPEC_TRACE.md'), path.join(ROOT, 'templates', 'SHOW_BIBLE.md'),
    ...fs.readdirSync(path.join(ROOT, 'references')).filter((f) => f !== 'hebrew-voice.md').map((f) => path.join(ROOT, 'references', f))];
  for (const f of files) {
    const errs = lintText(fs.readFileSync(f, 'utf8')).filter((x) => x.severity === 'error');
    assert.deepEqual(errs, [], `${path.relative(repo, f)}: ${JSON.stringify(errs)}`);
  }
});

test('every skill, command and agent has valid frontmatter and skills name their folder', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'skills'));
  assert.equal(dirs.length, 17);
  for (const d of dirs) {
    const t = fs.readFileSync(path.join(ROOT, 'skills', d, 'SKILL.md'), 'utf8');
    assert.match(t, new RegExp(`^---\\nname: ${d}\\ndescription: ".{40,}"\\n---\\n`), d);
    assert.ok(t.includes('## Engine') || d === 'systm-creator-os' || t.includes('{{'), d);
    assert.ok(!t.includes('{{'), `${d} has an unreplaced template marker`);
  }
  assert.equal(fs.readdirSync(path.join(ROOT, 'commands')).length, 14);
  assert.equal(fs.readdirSync(path.join(ROOT, 'agents')).length, 3);
});
