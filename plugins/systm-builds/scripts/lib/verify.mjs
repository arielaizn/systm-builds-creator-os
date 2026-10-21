import fs from 'node:fs';
import path from 'node:path';
import { BEATS, AXES, RESULT_BEATS } from './model.mjs';
import { check } from './schema.mjs';
import { exists, readJson, walk, words, wordCount } from './util.mjs';
import { epPaths, loadConfig } from './episode.mjs';
import { hasHebrew, lintText, RLM } from './he.mjs';
import { hookIssues, maatpaIssues, noveltyConflicts } from './stages.mjs';
import { productGate } from './launch.mjs';
import { buildAll } from './build.mjs';

const TRIGGERS = [
  { type: 'built', re: /(בניתי|בנינו|הקמתי|פיתחתי|פיתחנו|בנוי|השקתי|השקנו|פרסתי)/u },
  { type: 'time_saved', re: /(חסכ(תי|נו|ה|ו|ים)|חסך|חוסך|חוסכת|חוסכים|חיסכון|(\d+|כמה|הרבה|שעתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|עשרה|עשרים)\s+(שעות|דקות|ימי עבודה|ימים)|שעות\s+(עבודה|של))/u },
  { type: 'roi', re: /(ROI|החזר השקעה|הרווחנו|הרווחתי|הכנסות|עלייה של|ירידה של|\d+\s*%|\d+\s*אחוז|פי\s+(\d+|שניים|שלושה|ארבעה|עשרה)|₪\s*\d|\d\s*₪)/u },
  { type: 'social_proof', re: /((אלפי|מאות|עשרות)\s+(לקוחות|משתמשים|עסקים|בעלי עסקים))|לקוחות מרוצים|הכי טוב בישראל|מספר\s*1/u },
  { type: 'quote', re: /(אמר לי|אמרה לי|כתב לי|כתבה לי|"[^"]{8,}")/u },
  { type: 'customer', re: /(הלקוח שלי|הלקוחה שלי|הלקוחות שלי|אחד הלקוחות)/u },
];
const STRICT = new Set(['roi', 'time_saved', 'social_proof', 'customer', 'quote']);
const REQUEST_WORDS = /(ביקשתם|ביקשת|ביקשו|פנו אליי|פנית אליי|קיבלתי הודעה|כתבתם לי|שאלתם אותי)/u;
const GIVEAWAY_WORDS = /(בחינם|חינם|להוריד|הורדה|קוד פתוח|גיטהאב|github|קישור|בספרייה|מתנה|הקוד)/iu;
const SOFTENER = /(עדיין|בקרוב|כשזה|אחרי שזה|אחרי שאני|לא\s|אין\s)/u;
const SECRETS = [
  /sk-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /(api[_-]?key|secret|token|password|סיסמה)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i,
];
const PHONE = /(?:\+972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function loadRequests(ws) {
  const f = path.join(ws.series, 'requests.jsonl');
  if (!exists(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function ctxLoad(ws, id) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const errors = {};
  const get = (file, schema) => {
    if (!exists(file)) return null;
    try {
      const d = readJson(file);
      if (schema) errors[schema] = check(schema, d);
      return d;
    } catch (e) { errors[schema ?? file] = [{ path: '/', msg: `invalid JSON: ${e.message}` }]; return null; }
  };
  const ctx = {
    ws, id, p, cfg, errors,
    input: get(p.input, 'input'), idea: get(p.idea, 'idea'), hooks: get(p.hooks, 'hooks'), maatpa: get(p.maatpa, 'maatpa'),
    script: get(p.script, 'script'), distribution: get(p.distribution, 'distribution'), product: get(p.product, 'product'),
    requests: loadRequests(ws),
  };
  ctx.ev = new Map((ctx.input?.evidence ?? []).map((e) => [e.id, e]));
  return ctx;
}

const fmtErr = (es) => es.slice(0, 6).map((e) => `${e.path} ${e.msg}`);

export function runChecks(ws, id, { stage = 'plan' } = {}) {
  const c = ctxLoad(ws, id);
  const checks = [];
  const add = (cid, title, acceptance, status, details = []) => checks.push({ id: cid, title, acceptance, status, details });
  const release = stage === 'release';
  const { input, script, cfg, p } = c;
  const beatsOk = script && !c.errors.script?.length;

  // V01 input
  if (!input) add('V01', 'Episode input', 1, 'FAIL', ['input.json missing']);
  else add('V01', 'Episode input', 1, c.errors.input.length ? 'FAIL' : 'PASS', fmtErr(c.errors.input));

  // V02 13 beats
  if (!script) add('V02', '13-beat script', 1, 'FAIL', ['script.json missing']);
  else {
    const d = fmtErr(c.errors.script);
    const ns = script.beats?.map((b) => b.n).join(',');
    if (ns !== BEATS.map((b) => b.n).join(',')) d.push(`beats must be numbered 1..13 in order, got ${ns}`);
    for (const b of script.beats ?? []) {
      if (b.combined_with) continue;
      if (!b.vo?.trim()) d.push(`beat ${b.n} has no VO`);
      else if (!hasHebrew(b.vo)) d.push(`beat ${b.n} VO has no Hebrew`);
      if (!b.on_screen_text?.trim()) d.push(`beat ${b.n} has no on-screen text`);
      if (!b.viewer_question?.trim()) d.push(`beat ${b.n} has no viewer question`);
    }
    add('V02', '13-beat script', 1, d.length ? 'FAIL' : 'PASS', d);
  }

  // V03 timing
  if (!beatsOk) add('V03', 'Timing', 4, 'BLOCKED', ['script invalid']);
  else {
    const t = buildAll(p, script, cfg, id).timing;
    const d = [`${t.total_s}s, ${t.total_frames} frames at ${t.fps}fps, ${t.total_words} words, ${t.wps} words/s (${t.wps_source})`];
    let st = 'PASS';
    if (t.total_s < cfg.format.hard_min_s || t.total_s > cfg.format.hard_max_s) { st = 'FAIL'; d.push(`outside hard range ${cfg.format.hard_min_s}-${cfg.format.hard_max_s}s`); }
    else if (!t.in_target_range) { st = 'WARN'; d.push(`outside target ${cfg.format.target_min_s}-${cfg.format.target_max_s}s`); }
    if (t.wps_source === 'config_estimate') { if (st === 'PASS') st = 'WARN'; d.push('duration is an estimate until the real VO is recorded: run `systm script ' + id + ' --calibrate-seconds <vo seconds>`'); }
    add('V03', 'Timing', 4, st, d);
  }

  // V04 maatpa
  if (!c.maatpa) add('V04', 'MAATPA five axes + one NOVEL_ELEMENT', 2, 'FAIL', ['maatpa.json missing']);
  else {
    const es = c.errors.maatpa;
    const iss = es.length ? [] : [...maatpaIssues(c.maatpa), ...noveltyConflicts(ws, id, c.maatpa, cfg)];
    const bad = iss.filter((x) => x.severity === 'error');
    add('V04', 'MAATPA five axes + one NOVEL_ELEMENT', 2, es.length || bad.length ? 'FAIL' : iss.length ? 'WARN' : 'PASS', [...fmtErr(es), ...iss.map((x) => `${x.code}: ${x.msg}`)]);
  }

  // V05 hooks
  if (!c.hooks) add('V05', '12 scored truthful hooks', 3, 'FAIL', ['hooks.json missing']);
  else {
    const es = c.errors.hooks;
    const iss = es.length ? [] : hookIssues(c.hooks, input ?? {}, cfg);
    const unscored = es.length ? 0 : c.hooks.hooks.filter((h) => Object.values(h.scores).every((v) => v === 0)).length;
    const d = [...fmtErr(es), ...iss.map((x) => `${x.code}: ${x.msg}`)];
    if (unscored) d.push(`${unscored} hooks still have all-zero scores`);
    add('V05', '12 scored truthful hooks', 3, es.length || unscored || iss.some((x) => x.severity === 'error') ? 'FAIL' : iss.length ? 'WARN' : 'PASS', d);
    if (script && beatsOk && !es.length) {
      const sel = c.hooks.hooks.find((h) => h.id === c.hooks.selected);
      const norm = (s) => s.replace(/[\s.,!?"'׳״:;]+/g, ' ').trim();
      if (sel && !norm(script.beats[0].vo).startsWith(norm(sel.text).slice(0, 12))) {
        add('V05b', 'Beat 1 opens with the selected hook', 3, 'WARN', [`beat 1 VO does not start with ${sel.id}: "${sel.text}"`]);
      }
    }
  }

  // V06 deliverables regenerate byte-identically
  if (!beatsOk) add('V06', 'Shotlist, EDL, VO, SRT/VTT, sound cues, motion props', 4, 'BLOCKED', ['script invalid']);
  else {
    const built = buildAll(p, script, cfg, id);
    const d = [];
    for (const [file, text] of built.files) {
      const rel = path.relative(p.dir, file);
      if (!exists(file) || !fs.readFileSync(file, 'utf8').trim()) d.push(`${rel} missing or empty`);
      else if (fs.readFileSync(file, 'utf8') !== text) d.push(`${rel} is stale, run \`systm build ${id}\``);
    }
    add('V06', 'Shotlist, EDL, VO, SRT/VTT, sound cues, motion props', 4, d.length ? 'FAIL' : 'PASS', d);
  }

  // V07 Hebrew RTL + mobile typography
  if (!beatsOk) add('V07', 'Hebrew RTL and mobile-safe typography', 5, 'BLOCKED', ['script invalid']);
  else {
    const d = [];
    let st = 'PASS';
    const warn = (m) => { d.push(m); if (st === 'PASS') st = 'WARN'; };
    const fail = (m) => { d.push(m); st = 'FAIL'; };
    if (exists(p.srt)) {
      const blocks = fs.readFileSync(p.srt, 'utf8').trim().split(/\n\n+/);
      let prevEnd = -1;
      for (const b of blocks) {
        const ls = b.split('\n');
        const m = ls[1]?.match(/(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)/);
        const text = ls.slice(2);
        const sec = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
        if (!m) { fail(`cue ${ls[0]} has no valid timing`); continue; }
        const a = sec(m[1], m[2], m[3], m[4]);
        const z = sec(m[5], m[6], m[7], m[8]);
        if (a < prevEnd - 0.001) fail(`cue ${ls[0]} overlaps the previous cue`);
        if (z - a < cfg.captions.min_cue_s) warn(`cue ${ls[0]} is ${(z - a).toFixed(2)}s, under ${cfg.captions.min_cue_s}s (hard to read)`);
        prevEnd = z;
        if (text.length > cfg.captions.max_lines) fail(`cue ${ls[0]} has ${text.length} lines`);
        for (const l of text) {
          const bare = l.replace(RLM, '');
          if (bare.length > cfg.captions.max_chars_per_line) fail(`cue ${ls[0]} line is ${bare.length} chars (max ${cfg.captions.max_chars_per_line})`);
          if (cfg.captions.rlm && hasHebrew(bare) && !l.startsWith(RLM)) fail(`cue ${ls[0]} Hebrew line is missing the RLM mark`);
        }
      }
    } else fail('captions.he.srt missing');
    for (const b of script.beats) {
      const n = wordCount(b.on_screen_text);
      if (n > cfg.overlays.max_words * 2) fail(`beat ${b.n} overlay has ${n} words`);
      else if (n > cfg.overlays.max_words) warn(`beat ${b.n} overlay has ${n} words (max ${cfg.overlays.max_words} for a phone headline)`);
    }
    const f = cfg.format;
    if (f.width !== 1080 || f.height !== 1920 || f.fps !== 30) warn(`format is ${f.width}x${f.height}@${f.fps}, the show format is 1080x1920@30`);
    const sz = cfg.safe_zone;
    if (sz.top + sz.bottom > f.height * 0.5) fail('safe zone eats more than half the frame');
    if (!exists(p.motion)) warn('motion-props.json missing (safe zone not applied)');
    add('V07', 'Hebrew RTL and mobile-safe typography', 5, st, d);
  }

  // V08 voice lint
  {
    const found = [];
    const scan = (where, text, opt) => { for (const f of lintText(text, opt)) found.push({ where, ...f }); };
    for (const b of script?.beats ?? []) { scan(`beat ${b.n} vo`, b.vo, { hook: b.n === 1 }); scan(`beat ${b.n} overlay`, b.on_screen_text); }
    for (const h of c.hooks?.hooks ?? []) if (h.id === c.hooks.selected) scan(`hook ${h.id}`, h.text, { hook: true });
    const d = c.distribution;
    if (d) {
      scan('instagram caption', d.platforms.instagram.caption); scan('instagram story', d.platforms.instagram.story_teaser);
      scan('tiktok caption', d.platforms.tiktok.caption); scan('shorts title', d.platforms.shorts.title); scan('shorts description', d.platforms.shorts.description);
      scan('linkedin caption', d.platforms.linkedin.caption); scan('thumbnail text', d.thumbnail_text);
    }
    const errs = found.filter((f) => f.severity === 'error');
    add('V08', 'Hebrew voice lint (no AI-sounding copy)', 5, errs.length ? 'FAIL' : found.length ? 'WARN' : 'PASS', found.map((f) => `${f.severity.toUpperCase()} ${f.where}: ${f.code} "${f.match}"`));
  }

  // V09 claims and evidence
  if (!input || !beatsOk) add('V09', 'No invented proof (claims need evidence)', 6, 'BLOCKED', ['input or script invalid']);
  else {
    const d = [];
    let st = 'PASS';
    const fail = (m) => { d.push(m); st = 'FAIL'; };
    const claims = script.claims ?? [];
    const diag = input.status === 'DIAGNOSIS';
    for (const e of input.evidence ?? []) {
      if (e.state === 'planned') continue;
      if (!e.ref?.trim()) fail(`${e.id} is ${e.state} but has no ref (file or URL)`);
      else if (!/^https?:\/\//.test(e.ref) && !exists(path.resolve(p.dir, e.ref))) fail(`${e.id} is ${e.state} but ${e.ref} does not exist (paths are relative to the episode folder)`);
      if (e.state === 'verified' && !e.verified_by?.trim()) fail(`${e.id} is verified but has no verified_by`);
    }
    for (const b of script.beats) {
      const text = `${b.vo} ${b.on_screen_text}`;
      for (const t of TRIGGERS) {
        const m = text.match(t.re);
        if (m && !claims.some((cl) => cl.beat === b.n && cl.type === t.type)) fail(`beat ${b.n} says "${m[0]}" (${t.type}) with no ${t.type} claim in claims[]`);
      }
      for (const e of b.evidence ?? []) if (!c.ev.has(e)) fail(`beat ${b.n} cites unknown evidence ${e}`);
      if (RESULT_BEATS.includes(b.n) && !diag && !(b.evidence ?? []).length) fail(`beat ${b.n} shows a result and has no evidence ids`);
    }
    for (const cl of claims) {
      if (!cl.evidence.length) { fail(`${cl.id} (${cl.type}) has no evidence`); continue; }
      const evs = cl.evidence.map((e) => c.ev.get(e));
      if (evs.some((e) => !e)) { fail(`${cl.id} cites unknown evidence`); continue; }
      if (diag && ['built', 'result', 'availability'].includes(cl.type)) fail(`${cl.id}: DIAGNOSIS episodes are concept only, no "${cl.type}" claims`);
      if (STRICT.has(cl.type) && evs.some((e) => e.synthetic)) fail(`${cl.id}: synthetic data cannot back a ${cl.type} claim`);
      if (release && evs.some((e) => e.state !== 'verified')) fail(`${cl.id}: evidence ${cl.evidence.filter((_, i) => evs[i].state !== 'verified').join(',')} is not verified yet`);
      if (!release && evs.some((e) => e.state === 'planned') && STRICT.has(cl.type)) fail(`${cl.id}: a ${cl.type} claim cannot rest on planned evidence, only on captured or verified`);
      if (cl.type === 'quote') {
        const r = c.requests.find((x) => x.id === cl.request_ref);
        if (!r) fail(`${cl.id}: quote has no request_ref in the requests ledger`);
        else if (r.consent !== 'obtained') fail(`${cl.id}: ${r.id} has no consent to quote`);
      }
    }
    if (release) {
      for (const b of script.beats) for (const e of b.evidence ?? []) { const ev = c.ev.get(e); if (ev && ev.state !== 'verified') fail(`beat ${b.n}: evidence ${e} is ${ev.state}, release needs verified`); }
      if (input.status === 'BUILT' && !(input.evidence ?? []).some((e) => ['test_output', 'screen_recording'].includes(e.kind) && e.state === 'verified')) fail('BUILT needs a verified test_output or screen_recording of the real tool running (demo input data is fine, a mock-up is not)');
    } else if (input.status === 'BUILT' && !(input.evidence ?? []).some((e) => ['test_output', 'screen_recording'].includes(e.kind))) {
      d.push('BUILT episode lists no test_output or screen_recording evidence yet'); if (st === 'PASS') st = 'WARN';
    }
    add('V09', 'No invented proof (claims need evidence)', 6, st, d);
  }

  // V10 mode, synthetic labelling, origin and consent
  if (!input || !beatsOk) add('V10', 'Mode, synthetic labelling, origin and consent', 6, 'BLOCKED', ['input or script invalid']);
  else {
    const d = [];
    let st = 'PASS';
    const fail = (m) => { d.push(m); st = 'FAIL'; };
    const synth = new Set((input.evidence ?? []).filter((e) => e.synthetic).map((e) => e.id));
    const label = script.synthetic_label?.trim();
    for (const b of script.beats) {
      if ((b.evidence ?? []).some((e) => synth.has(e)) && (!label || !b.on_screen_text.includes(label))) fail(`beat ${b.n} shows synthetic data without the on-screen label${label ? ` "${label}"` : ' (set synthetic_label)'}`);
    }
    const b7 = script.beats[6];
    if (input.origin === 'observed_need' && b7 && REQUEST_WORDS.test(`${b7.vo} ${b7.on_screen_text}`)) fail('beat 7 implies someone asked for this, but origin is observed_need');
    if (input.origin === 'consented_request') {
      const r = c.requests.find((x) => x.id === input.request_ref);
      if (!input.request_ref || !r) { d.push('consented_request needs request_ref pointing at the requests ledger'); if (release) st = 'FAIL'; else if (st === 'PASS') st = 'WARN'; }
      else if (r.consent !== 'obtained') { d.push(`${r.id} has consent "${r.consent}", needs "obtained"`); if (release) st = 'FAIL'; else if (st === 'PASS') st = 'WARN'; }
      else if (!r.source_ref) fail(`${r.id} has no source_ref (where the request really came from)`);
    }
    add('V10', 'Mode, synthetic labelling, origin and consent', 6, st, d);
  }

  // V11 giveaway gate
  if (!input || !beatsOk) add('V11', 'Giveaway blocked when links/license are missing', 7, 'BLOCKED', ['input or script invalid']);
  else {
    const gate = c.product ? productGate(c.product, input, p.dir) : { verdict: 'BLOCKED', missing: ['product.json missing'], checks: [] };
    const d = [];
    let st = 'PASS';
    const b13 = script.beats[12];
    const text13 = `${b13.vo} ${b13.on_screen_text}`;
    if (gate.verdict === 'BLOCKED') {
      if (script.cta.type === 'giveaway') { st = 'FAIL'; d.push('cta.type is giveaway but the release gate is BLOCKED'); }
      for (const s of text13.split(/(?<=[.!?])\s+/)) {
        if (GIVEAWAY_WORDS.test(s) && !SOFTENER.test(s)) { st = 'FAIL'; d.push(`beat 13 promises access while the gate is blocked: "${s.trim()}"`); }
      }
      if (st === 'PASS') d.push(`gate BLOCKED (${gate.missing.length} missing), CTA is honest (${script.cta.type})`);
    } else d.push('gate OPEN');
    if (gate.verdict === 'OPEN' && script.cta.type !== 'giveaway') d.push('gate is open but the CTA is not a giveaway (fine, but a free product is a reason to ask for the next one)');
    if (input.status === 'DIAGNOSIS' && script.cta.type === 'giveaway') { st = 'FAIL'; d.push('DIAGNOSIS episodes cannot offer a giveaway'); }
    add('V11', 'Giveaway blocked when links/license are missing', 7, st, d);
  }

  // V12 secrets / PII
  {
    const d = [];
    let st = 'PASS';
    const files = walk(c.p.dir, (f) => /\.(json|md|csv|srt|vtt|txt)$/.test(f) && !f.includes(`${path.sep}verify${path.sep}`));
    const reqFile = path.join(ws.series, 'requests.jsonl');
    if (exists(reqFile)) files.push(reqFile);
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const rel = path.relative(ws.dir, f);
      if (SECRETS.some((re) => re.test(text))) { st = 'FAIL'; d.push(`${rel}: looks like a secret`); }
      if (PHONE.test(text)) { st = 'FAIL'; d.push(`${rel}: contains a phone number`); }
      if (EMAIL.test(text) && st === 'PASS') { st = 'WARN'; d.push(`${rel}: contains an email address, make sure it is a public support address`); }
    }
    add('V12', 'No secrets or personal data', 8, st, d.length ? d : [`${files.length} files scanned`]);
  }

  // V13 remote writes
  {
    const d = [];
    let st = 'PASS';
    if (exists(p.plan)) {
      const plan = readJson(p.plan);
      if (plan.dry_run !== true) { st = 'FAIL'; d.push('plan.json is not dry_run'); }
      if ((plan.remote_writes ?? []).length) { st = 'FAIL'; d.push('plan.json records remote writes'); }
      if (exists(p.approvals)) {
        const ap = readJson(p.approvals);
        for (const a of ap.approvals ?? []) {
          const item = (plan.items ?? []).find((i) => i.action === a.action);
          if (!item) { if (st === 'PASS') st = 'WARN'; d.push(`approval ${a.action} matches no plan item`); }
          else if (item.content_sha256 !== a.content_sha256) { if (st === 'PASS') st = 'WARN'; d.push(`approval ${a.action} is stale, content changed after approval`); }
        }
      }
    }
    if (st === 'PASS') d.push('no remote write recorded; the plugin has no code that posts or sends');
    add('V13', 'No remote write without approval', 9, st, d);
  }

  // V14 sound design
  if (!beatsOk) add('V14', 'Sound design rules', 4, 'BLOCKED', ['script invalid']);
  else {
    const s = script.sound ?? [];
    const d = [];
    let st = 'PASS';
    const fail = (m) => { d.push(m); st = 'FAIL'; };
    const count = (t) => s.filter((x) => x.type === t).length;
    if (count('REVEAL_HIT') !== 1) fail(`needs exactly one REVEAL_HIT, found ${count('REVEAL_HIT')}`);
    if (count('SONIC_LOGO') !== 1) fail(`needs exactly one SONIC_LOGO, found ${count('SONIC_LOGO')}`);
    if (count('SILENCE') < 1) fail('needs a SILENCE at the twist');
    const timing = buildAll(p, script, cfg, id).timing;
    for (const x of s.filter((y) => y.type === 'SILENCE')) {
      const r = timing.beats.find((b) => b.n === x.beat);
      const speechEnd = r.end_s - r.pause_after_s;
      if (r && r.start_s + (x.offset_s ?? 0) < speechEnd - 0.05) fail(`beat ${x.beat} SILENCE at ${(r.start_s + (x.offset_s ?? 0)).toFixed(2)}s lands on speech (VO runs to ${speechEnd.toFixed(2)}s): set offset_s >= ${(speechEnd - r.start_s).toFixed(2)}`);
    }
    for (const x of s.filter((y) => y.asset)) if (!x.license?.trim() || /unknown|none|לא ידוע/i.test(x.license)) fail(`beat ${x.beat} ${x.type} asset "${x.asset}" has no licence recorded`);
    add('V14', 'Sound design rules', 4, st, d);
  }

  const rank = { FAIL: 3, BLOCKED: 2, WARN: 1, PASS: 0 };
  const worst = checks.reduce((w, k) => (rank[k.status] > rank[w] ? k.status : w), 'PASS');
  return {
    schema: 'systm/verify@1', episode_id: id, stage, verdict: worst,
    counts: Object.fromEntries(['PASS', 'WARN', 'BLOCKED', 'FAIL'].map((k) => [k, checks.filter((x) => x.status === k).length])),
    checks,
  };
}

export function verifyMd(rep) {
  const icon = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL', BLOCKED: 'BLOCKED' };
  const rows = rep.checks.map((k) => `### ${k.id} · ${k.title} · ${icon[k.status]}${k.acceptance ? ` (acceptance ${k.acceptance})` : ''}\n\n${k.details.length ? k.details.map((x) => `- ${x}`).join('\n') : '- ok'}`);
  return `# ${rep.episode_id} · verifier (${rep.stage})\n\nverdict: **${rep.verdict}** · ${Object.entries(rep.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}\n\n${rows.join('\n\n')}\n`;
}
