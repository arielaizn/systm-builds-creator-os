import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cli, tmpSample } from './helpers.mjs';

// Turns the planned sample into a fully evidenced BUILT episode, as a creator would after capturing and
// verifying everything, and walks the positive path: release verify, gate OPEN, linked plan, ready package.
function makeBuilt(s) {
  fs.mkdirSync(path.join(s.ep, 'captures'), { recursive: true });
  for (const f of ['E1.mov', 'E2.mov', 'E3.txt', 'E4.md', 'shot1.png']) fs.writeFileSync(path.join(s.ep, 'captures', f), 'x');
  s.edit('input.json', (o) => {
    o.status = 'BUILT';
    o.hosted_url = 'https://app.followup-demo.dev';
    o.repo_url = 'https://github.com/acme-co/followup-tool';
    const refs = { E1: 'captures/E1.mov', E2: 'captures/E2.mov', E3: 'captures/E3.txt', E4: 'captures/E4.md' };
    for (const e of o.evidence) { e.state = 'verified'; e.ref = refs[e.id]; e.verified_by = 'creator'; }
  });
  s.edit('script.json', (o) => {
    o.cta = { type: 'giveaway', giveaway: 'גרסה חינמית באירוח וקוד פתוח, הקישור בתגובה הראשונה', next_request: 'איזה כלי לעסק לבנות אחרי זה?' };
    o.beats[12].vo = 'זה חינם: הקישור בתגובה הראשונה. איזה כלי לעסק לבנות עכשיו? אתם מבקשים. אני בונה. כולם מקבלים.';
  });
  s.edit('product.json', (o) => {
    Object.assign(o, { status: 'BUILT', version: '0.1.0', hosted_url: 'https://app.followup-demo.dev', repo_url: 'https://github.com/acme-co/followup-tool',
      hosted_url_tested: { tested_on: '2026-02-01', tested_by: 'creator' }, repo_url_tested: { tested_on: '2026-02-01', tested_by: 'creator' },
      license: 'MIT', install: 'פותחים את הכתובת, מעלים CSV', quotas: '100 לידים בקובץ, 20 הרצות ביום', costs: { hosting: 'שכבה חינמית, אני משלם', api: 'מפתח שלי, מוגבל', third_party: 'אין' },
      privacy: 'הקובץ נמחק אחרי ההרצה', known_issues: ['לא תומך בקבצי אקסל, רק CSV'], support: 'issues בריפו', screenshots: ['captures/shot1.png'] });
  });
}

test('release path: verified BUILT episode passes, gate opens, plan carries UTMs, package is ready', () => {
  const s = tmpSample();
  try {
    makeBuilt(s);
    assert.equal(cli(['script', 'EP001', '--calibrate-seconds', '64'], s.dir).code, 0);
    assert.equal(cli(['build', 'EP001'], s.dir).code, 0);
    const v = cli(['verify', 'EP001', '--stage', 'release'], s.dir);
    assert.equal(v.code, 0, v.out);
    assert.match(v.out, /verdict \(release\): (PASS|WARN)/);
    const g = cli(['launch', 'EP001'], s.dir);
    assert.equal(g.code, 0, g.out);
    assert.match(g.out, /release gate: OPEN/);
    assert.match(g.out, /URLs were not checked/);
    assert.equal(s.read('launch/gate.json').url_check, 'not_run');
    const d = cli(['distribute', 'EP001'], s.dir);
    assert.equal(d.code, 0, d.out);
    const plan = s.read('distribute/plan.json');
    assert.equal(plan.gate, 'OPEN');
    assert.equal(plan.dry_run, true);
    const ig = plan.items.find((i) => i.platform === 'instagram');
    assert.match(ig.link, /^https:\/\/app\.followup-demo\.dev\/\?utm_source=instagram&utm_medium=organic_social&utm_campaign=ep001&utm_content=H01&utm_term=/);
    assert.equal(ig.approved, false);
    // not ready until the rendered video was QA'd and the URLs were actually checked
    const early = cli(['package', 'EP001'], s.dir);
    assert.match(early.out, /ready_to_publish=false/);
    assert.match(early.out, /no media QA/);
    assert.match(early.out, /URLs were never checked/);
    s.write('qa/media.json', { schema: 'systm/media-qa@1', episode_id: 'EP001', file: 'EP001.mp4', verdict: 'PASS', duration_s: 64, checks: [] });
    s.edit('launch/gate.json', (o) => { o.url_check = 'passed'; });
    const pk = cli(['package', 'EP001'], s.dir);
    assert.match(pk.out, /ready_to_publish=true/, pk.out);
    assert.equal(s.read('package/manifest.json').ready_to_publish, true);
  } finally { s.cleanup(); }
});

test('release path: one planned evidence item, a missing capture file, or a blank verified_by each block it', () => {
  const s = tmpSample();
  try {
    makeBuilt(s);
    cli(['script', 'EP001', '--calibrate-seconds', '64'], s.dir);
    cli(['build', 'EP001'], s.dir);
    s.edit('input.json', (o) => { o.evidence[1].state = 'planned'; });
    assert.equal(cli(['verify', 'EP001', '--stage', 'release'], s.dir).code, 1);
    s.edit('input.json', (o) => { o.evidence[1].state = 'verified'; });
    assert.equal(cli(['verify', 'EP001', '--stage', 'release'], s.dir).code, 0);
    fs.rmSync(path.join(s.ep, 'captures', 'E2.mov'));
    assert.match(cli(['verify', 'EP001', '--stage', 'release'], s.dir).out, /E2 is verified but captures\/E2.mov is missing, empty or a folder/);
    fs.writeFileSync(path.join(s.ep, 'captures', 'E2.mov'), 'x');
    s.edit('input.json', (o) => { o.evidence[2].verified_by = ''; });
    assert.match(cli(['verify', 'EP001', '--stage', 'release'], s.dir).out, /E3 is verified but verified_by is empty/);
  } finally { s.cleanup(); }
});

test('release path: opening the gate with a missing license puts the sample back to blocked', () => {
  const s = tmpSample();
  try {
    makeBuilt(s);
    s.edit('product.json', (o) => { o.license = null; });
    const g = cli(['launch', 'EP001'], s.dir);
    assert.equal(g.code, 2);
    assert.match(g.out, /license must be a recognised SPDX id/);
    const v = cli(['verify', 'EP001'], s.dir);
    assert.match(v.out, /V11/);
    assert.equal(v.code, 1, 'giveaway CTA with a blocked gate must FAIL');
  } finally { s.cleanup(); }
});
