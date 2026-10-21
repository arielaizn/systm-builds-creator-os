import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workspace } from '../scripts/lib/episode.mjs';
import { runChecks } from '../scripts/lib/verify.mjs';
import { cmdBuild, cmdDistribute } from '../scripts/lib/commands.mjs';
import { tmpSample } from './helpers.mjs';

const run = (s, stage = 'plan') => {
  const ws = workspace(s.dir);
  cmdBuild(ws, 'EP001');
  return runChecks(ws, 'EP001', { stage });
};
const get = (rep, id) => rep.checks.find((c) => c.id === id);
const withSample = (fn) => () => { const s = tmpSample(); try { fn(s); } finally { s.cleanup(); } };

test('baseline sample: no FAIL, only the honest duration estimate warns', withSample((s) => {
  const rep = run(s);
  assert.equal(rep.counts.FAIL, 0, JSON.stringify(rep.checks.filter((c) => c.status === 'FAIL')));
  assert.deepEqual(rep.checks.filter((c) => c.status === 'WARN').map((c) => c.id), ['V03']);
}));

test('release stage refuses planned evidence', withSample((s) => {
  const rep = run(s, 'release');
  assert.equal(get(rep, 'V09').status, 'FAIL');
  assert.match(get(rep, 'V09').details.join(' '), /not verified/);
}));

test('V09: "saved hours" in the VO without a time_saved claim fails', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[9].vo += ' זה חסך לנו שעות.'; });
  const rep = run(s);
  assert.equal(get(rep, 'V09').status, 'FAIL');
  assert.match(get(rep, 'V09').details.join(' '), /time_saved/);
}));

test('V09: a time_saved claim cannot rest on synthetic or planned evidence', withSample((s) => {
  s.edit('script.json', (o) => {
    o.beats[9].vo += ' זה חסך לנו שעות.';
    o.claims.push({ id: 'C9', text: 'חסך שעות', type: 'time_saved', beat: 10, evidence: ['E1'] });
  });
  const rep = run(s);
  assert.match(get(rep, 'V09').details.join(' '), /synthetic data cannot back a time_saved/);
}));

test('V09: a quote needs a consented request in the ledger', withSample((s) => {
  s.edit('script.json', (o) => {
    o.beats[6].vo += ' אחד מהם כתב לי שזה חסר לו.';
    o.claims.push({ id: 'C8', text: 'ציטוט', type: 'quote', beat: 7, evidence: ['E4'], request_ref: 'R001' });
  });
  const rep = run(s);
  assert.match(get(rep, 'V09').details.join(' '), /requests ledger/);
}));

test('V09: a result beat with no evidence fails', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[0].evidence = []; });
  assert.match(get(run(s), 'V09').details.join(' '), /beat 1 shows a result/);
}));

test('V10: synthetic evidence without the on-screen label fails', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[8].on_screen_text = 'ליד כפול'; });
  assert.match(get(run(s), 'V10').details.join(' '), /synthetic data without the on-screen label/);
}));

test('V10: an observed need cannot pose as an audience request', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[6].vo = 'ביקשתם ממני כלי למעקב אחרי לידים.'; });
  assert.match(get(run(s), 'V10').details.join(' '), /implies someone asked/);
}));

test('V11: giveaway CTA fails while the gate is blocked', withSample((s) => {
  s.edit('script.json', (o) => { o.cta.type = 'giveaway'; o.cta.giveaway = 'קישור בתגובה'; });
  assert.equal(get(run(s), 'V11').status, 'FAIL');
}));

test('V11: beat 13 promising a download while blocked fails, a softened one passes', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[12].vo = 'ההורדה מחכה לכם בקישור בתגובה הראשונה. איזה כלי לבנות הבא?'; });
  assert.equal(get(run(s), 'V11').status, 'FAIL');
  s.edit('script.json', (o) => { o.beats[12].vo = 'עדיין אין קישור להורדה. איזה כלי לבנות הבא?'; });
  assert.equal(get(run(s), 'V11').status, 'PASS');
}));

test('V11: DIAGNOSIS episodes cannot make built or result claims', withSample((s) => {
  s.edit('input.json', (o) => { o.status = 'DIAGNOSIS'; });
  assert.match(get(run(s), 'V09').details.join(' '), /concept only/);
}));

test('V12: secrets and phone numbers fail, emails warn', withSample((s) => {
  fs.writeFileSync(path.join(s.ep, 'notes.txt'), 'api_key = abcdefghijklmnop1234567890');
  assert.equal(get(run(s), 'V12').status, 'FAIL');
  fs.writeFileSync(path.join(s.ep, 'notes.txt'), 'call 052-123-4567');
  assert.equal(get(run(s), 'V12').status, 'FAIL');
  fs.writeFileSync(path.join(s.ep, 'notes.txt'), 'write to help@example.com');
  assert.equal(get(run(s), 'V12').status, 'WARN');
}));

test('V13: a plan that is not a dry run fails, a stale approval warns', withSample((s) => {
  run(s);
  s.edit('distribute/plan.json', (o) => { o.dry_run = false; });
  assert.equal(get(run(s), 'V13').status, 'FAIL');
  s.edit('distribute/plan.json', (o) => { o.dry_run = true; });
  fs.writeFileSync(path.join(s.ep, 'approvals.json'), JSON.stringify({ schema: 'systm/approvals@1', episode_id: 'EP001', approvals: [{ action: 'post:instagram', content_sha256: 'deadbeef', approved_by: 'x' }] }));
  assert.equal(get(run(s), 'V13').status, 'WARN');
}));

test('V14: SILENCE on top of speech, a second REVEAL_HIT and an unlicensed asset all fail', withSample((s) => {
  s.edit('script.json', (o) => { o.sound.find((x) => x.type === 'SILENCE').offset_s = 0.5; });
  assert.match(get(run(s), 'V14').details.join(' '), /lands on speech/);
  s.edit('script.json', (o) => { o.sound.find((x) => x.type === 'SILENCE').offset_s = 3; o.sound.push({ beat: 9, type: 'REVEAL_HIT', note: 'x' }); });
  assert.match(get(run(s), 'V14').details.join(' '), /exactly one REVEAL_HIT/);
  s.edit('script.json', (o) => { o.sound.pop(); o.sound.find((x) => x.type === 'UI').asset = 'click.wav'; });
  assert.match(get(run(s), 'V14').details.join(' '), /no licence recorded/);
}));

test('V08: AI-sounding copy in the VO fails the voice lint', withSample((s) => {
  s.edit('script.json', (o) => { o.beats[3].vo = 'זה לא רק כלי אלא גם שיטה שמהווה פתרון.'; });
  assert.equal(get(run(s), 'V08').status, 'FAIL');
}));

test('V06: a hand-edited build file is reported stale', withSample((s) => {
  run(s);
  fs.appendFileSync(path.join(s.ep, 'build', 'edl.csv'), '0,0,x,x,x,x,x\n');
  const ws = workspace(s.dir);
  const rep = runChecks(ws, 'EP001', { stage: 'plan' });
  assert.equal(get(rep, 'V06').status, 'FAIL');
}));

test('V04: the same NOVEL_ELEMENT in the previous episode is an error', withSample((s) => {
  const copy = path.join(s.dir, 'systm', 'episodes', 'EP002');
  fs.mkdirSync(copy, { recursive: true });
  fs.copyFileSync(path.join(s.ep, 'maatpa.json'), path.join(copy, 'maatpa.json'));
  const ws = workspace(s.dir);
  cmdBuild(ws, 'EP001');
  // EP002 reuses duplicate_record; checking EP001 now sees a repeat inside the window
  const rep = runChecks(ws, 'EP001', { stage: 'plan' });
  assert.equal(get(rep, 'V04').status, 'FAIL');
  assert.match(get(rep, 'V04').details.join(' '), /NOVELTY_REPEAT/);
}));

test('distribute: blocked giveaway copy and an unverified keyword DM stop the plan', withSample((s) => {
  const ws = workspace(s.dir);
  s.edit('distribution.json', (o) => { o.platforms.tiktok.caption = 'הורדה בחינם, קישור בתגובה'; });
  let r = cmdDistribute(ws, 'EP001');
  assert.equal(r.exit, 1);
  assert.match(r.lines.join('\n'), /offers access while the release gate is blocked/);
  s.edit('distribution.json', (o) => { o.platforms.tiktok.caption = 'עדיין אין קישור.'; o.link_policy = 'keyword_dm'; });
  r = cmdDistribute(ws, 'EP001');
  assert.equal(r.exit, 1);
  assert.match(r.lines.join('\n'), /integration_verified/);
}));
