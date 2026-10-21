import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, EPISODE_ID, ORIGINS, STATUSES } from './model.mjs';
import { CliError, VERSION, contentHash, exists, readJson, sha256, walk, wordCount, writeJson, writeText } from './util.mjs';
import { check } from './schema.mjs';
import { assertId, epPaths, listEpisodes, loadConfig, provenance, requireFile, stageStatus, workspace } from './episode.mjs';
import { hookIssues, hooksMd, maatpaIssues, maatpaMd, noveltyConflicts, rankHooks, scaffold, scriptMd } from './stages.mjs';
import { buildAll } from './build.mjs';
import { lintText } from './he.mjs';
import { loadRequests, runChecks, verifyMd } from './verify.mjs';
import { checkUrls, productGate } from './launch.mjs';
import { buildPlan, distributionIssues, planMd, utmCsv } from './distribute.mjs';
import { analysisMd, analyze } from './analytics.mjs';
import { qaMedia } from './media.mjs';
import { doctor } from './doctor.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
export const PLUGIN_ROOT = path.resolve(here, '..', '..');

const res = (exit, lines, data) => ({ exit, lines, data });
const fmtErr = (es) => es.map((e) => `  ${e.path} ${e.msg}`);

function schemaGate(name, data, label) {
  const errs = check(name, data);
  if (errs.length) throw new CliError(`${label} does not match schema ${name}:\n${fmtErr(errs.slice(0, 15)).join('\n')}`);
}

function setStatus(file, status) {
  const o = readJson(file);
  o.status = status;
  writeJson(file, o);
}

// ---- workspace -----------------------------------------------------------------------------

export function cmdWhere(ws) {
  return res(0, [`plugin_root: ${PLUGIN_ROOT}`, `workspace:   ${ws.dir}`, `version:     ${VERSION}`]);
}

export function cmdDoctor(ws) {
  const d = doctor(ws, PLUGIN_ROOT);
  const lines = d.checks.map((c) => `${c.status.padEnd(5)} ${c.id.padEnd(18)} ${c.msg}${c.fix ? `  → ${c.fix}` : ''}`);
  lines.push(`verdict: ${d.verdict}`);
  return res(d.verdict === 'FAIL' ? 1 : 0, lines, d);
}

export function cmdInit(ws, { force = false } = {}) {
  const made = [];
  for (const d of [ws.dir, ws.series, ws.episodes, ws.out]) fs.mkdirSync(d, { recursive: true });
  const put = (file, text) => { if (force || !exists(file)) { writeText(file, text); made.push(path.relative(ws.base, file)); } };
  put(ws.config, JSON.stringify(DEFAULT_CONFIG, null, 2));
  put(path.join(ws.series, 'requests.jsonl'), '');
  put(path.join(ws.series, 'backlog.json'), JSON.stringify({ schema: 'systm/backlog@1', items: [] }, null, 2));
  put(path.join(ws.dir, 'SHOW_BIBLE.md'), fs.readFileSync(path.join(PLUGIN_ROOT, 'templates', 'SHOW_BIBLE.md'), 'utf8'));
  put(path.join(ws.dir, '.gitignore'), 'out/\n*.mp4\n*.mov\n*.wav\n.env\n');
  const d = doctor(ws, PLUGIN_ROOT);
  const lines = [made.length ? `created: ${made.join(', ')}` : 'workspace already initialised (use --force to overwrite config)', ...d.checks.filter((c) => c.status === 'WARN' || c.status === 'FAIL').map((c) => `${c.status} ${c.id}: ${c.msg}`)];
  return res(0, lines, { made, doctor: d });
}

// ---- requests and backlog ------------------------------------------------------------------

export function cmdRequest(ws, sub, opts) {
  const f = path.join(ws.series, 'requests.jsonl');
  fs.mkdirSync(ws.series, { recursive: true });
  const all = loadRequests(ws);
  if (sub === 'list' || !sub) {
    return res(0, all.length ? all.map((r) => `${r.id}  consent:${r.consent}  ${r.channel}  ${r.source_ref ? 'src' : 'NO-SRC'}  ${r.text.slice(0, 70)}`) : ['no requests logged yet'], all);
  }
  if (sub !== 'add') throw new CliError('request <add|list>');
  if (!opts.text || !opts.channel) throw new CliError('request add needs --text "<verbatim request>" --channel <instagram_comment|dm|form|email|in_person|other> [--source-ref <permalink>] [--consent obtained|pending|none]');
  const id = `R${String(all.length + 1).padStart(3, '0')}`;
  const entry = { id, text: String(opts.text), channel: String(opts.channel), source_ref: opts['source-ref'] ?? null, consent: ['obtained', 'pending', 'none'].includes(opts.consent) ? opts.consent : 'pending', received: opts.received ?? null, author_ref: opts['author-ref'] ?? null, notes: opts.notes ?? '' };
  fs.appendFileSync(f, JSON.stringify(entry) + '\n');
  const lines = [`logged ${id} (consent: ${entry.consent})`];
  if (!entry.source_ref) lines.push('WARN no --source-ref: this request is unverifiable and cannot be shown on screen as a real request');
  if (entry.consent !== 'obtained') lines.push('WARN consent is not "obtained": do not quote or show this person until it is');
  return res(0, lines, entry);
}

function loadBacklog(ws) {
  const f = path.join(ws.series, 'backlog.json');
  return exists(f) ? readJson(f) : { schema: 'systm/backlog@1', items: [] };
}

export function cmdBacklog(ws, sub, opts) {
  const f = path.join(ws.series, 'backlog.json');
  const bl = loadBacklog(ws);
  if (sub === 'add') {
    if (!opts.title) throw new CliError('backlog add --title "<tool idea>" [--request R001] [--priority 1-5] [--note ""]');
    const id = `B${String(bl.items.length + 1).padStart(3, '0')}`;
    const req = opts.request ? loadRequests(ws).find((r) => r.id === opts.request) : null;
    if (opts.request && !req) throw new CliError(`unknown request ${opts.request}`);
    bl.items.push({ id, title: String(opts.title), source: req ? 'request' : 'observed', request_ref: req?.id ?? null, status: 'queued', priority: Number(opts.priority ?? 3), note: opts.note ?? '' });
    writeJson(f, bl);
    return res(0, [`added ${id}${req ? ` (from ${req.id}, consent ${req.consent})` : ' (observed need, no request attached)'}`], bl.items.at(-1));
  }
  if (sub === 'next') {
    const reqs = loadRequests(ws);
    const rank = (i) => (i.request_ref && reqs.find((r) => r.id === i.request_ref)?.consent === 'obtained' ? 0 : i.request_ref ? 1 : 2);
    const next = bl.items.filter((i) => i.status === 'queued').sort((a, b) => rank(a) - rank(b) || b.priority - a.priority || a.id.localeCompare(b.id))[0];
    return res(0, next ? [`next: ${next.id} ${next.title} (${next.source}${next.request_ref ? ` ${next.request_ref}` : ''})`] : ['backlog has nothing queued'], next ?? null);
  }
  if (sub === 'set') {
    const it = bl.items.find((i) => i.id === opts._[0]);
    if (!it) throw new CliError('backlog set <B001> --status queued|in_production|published|dropped');
    it.status = opts.status ?? it.status;
    writeJson(f, bl);
    return res(0, [`${it.id} → ${it.status}`], it);
  }
  return res(0, bl.items.length ? bl.items.map((i) => `${i.id}  ${i.status.padEnd(13)} p${i.priority}  ${i.source}${i.request_ref ? ' ' + i.request_ref : ''}  ${i.title}`) : ['backlog is empty'], bl);
}

export function cmdNovelty(ws) {
  const rows = listEpisodes(ws).map((id) => {
    const p = epPaths(ws, id);
    if (!exists(p.maatpa)) return `${id}  (no maatpa yet)`;
    const m = readJson(p.maatpa);
    return `${id}  ${m.novel_element?.axis}:${m.novel_element?.key}  mechanic:${m.mechanic}`;
  });
  return res(0, rows.length ? rows : ['no episodes yet']);
}

// ---- episode stages ------------------------------------------------------------------------

export function cmdNew(ws, id, opts) {
  assertId(id);
  const p = epPaths(ws, id);
  if (exists(p.input) && !opts.force) throw new CliError(`${id} already exists (use --force to overwrite input.json)`);
  let base = {};
  if (opts.from) base = readJson(path.resolve(opts.from));
  const req = opts.request ? loadRequests(ws).find((r) => r.id === opts.request) : null;
  if (opts.request && !req) throw new CliError(`unknown request ${opts.request}`);
  const input = {
    schema: 'systm/input@1', episode_id: id,
    product: opts.product ?? base.product ?? '',
    status: opts.mode ?? base.status ?? 'PROTOTYPE',
    audience: opts.audience ?? base.audience ?? '',
    pain: opts.pain ?? base.pain ?? '',
    origin: req ? 'consented_request' : String(opts.origin ?? base.origin ?? base.source ?? 'observed_need').trim().replace(/\s+/g, '_'),
    request_ref: req?.id ?? base.request_ref ?? null,
    features: base.features ?? [], constraints: base.constraints ?? [],
    evidence: base.evidence ?? [],
    hosted_url: opts['hosted-url'] ?? base.hosted_url ?? null,
    repo_url: opts['repo-url'] ?? base.repo_url ?? null,
    keyword: opts.keyword ?? base.keyword ?? '',
    novel_element: opts.novel ?? base.novel_element ?? '',
  };
  const errors = check('input', input);
  fs.mkdirSync(p.dir, { recursive: true });
  writeJson(p.input, input);
  const lines = [`wrote ${path.relative(ws.base, p.input)}`];
  if (errors.length) lines.push('fill these fields next:', ...fmtErr(errors));
  return res(0, lines, input);
}

export function cmdScaffold(ws, stage, id) {
  const p = epPaths(ws, id);
  const targets = { idea: p.idea, hooks: p.hooks, maatpa: p.maatpa, script: p.script, distribution: p.distribution, product: p.product };
  if (!targets[stage]) throw new CliError(`scaffold <${Object.keys(targets).join('|')}> <EPxxx>`);
  if (exists(targets[stage])) throw new CliError(`${path.relative(ws.base, targets[stage])} already exists, not overwriting`);
  const input = exists(p.input) ? readJson(p.input) : null;
  writeJson(targets[stage], scaffold(stage, id, input));
  return res(0, [`wrote ${path.relative(ws.base, targets[stage])} (fill every field, then run the stage command)`]);
}

export function cmdIdea(ws, id) {
  const p = epPaths(ws, id);
  const input = requireFile(p.input, 'run `systm new` first');
  schemaGate('input', input, 'input.json');
  const idea = requireFile(p.idea, 'run `systm scaffold idea ' + id + '`');
  schemaGate('idea', idea, 'idea.json');
  const lines = [];
  let bad = false;
  if (input.origin === 'consented_request' && idea.consent.state !== 'obtained') { lines.push('WARN consent for the request is not "obtained" yet; V10 will block release'); }
  if (input.origin === 'consented_request' && !idea.consent.required) { lines.push('ERROR origin is consented_request but idea.consent.required is false'); bad = true; }
  if (input.origin === 'observed_need' && idea.consent.required) lines.push('WARN observed_need normally needs no consent; remove consent.required or change origin');
  const known = new Set();
  for (const c of idea.novel_candidates) { const k = `${c.axis}:${c.key}`; if (known.has(k)) { lines.push(`ERROR duplicate novelty candidate ${k}`); bad = true; } known.add(k); }
  idea.status = bad ? 'needs_revision' : 'ready';
  idea.provenance = provenance('idea', [p.input]);
  writeJson(p.idea, idea);
  lines.unshift(`idea ${bad ? 'NEEDS REVISION' : 'ok'}: one product "${idea.one_product}", one test "${idea.one_test}", mechanic ${idea.mechanic}`);
  return res(bad ? 1 : 0, lines);
}

export function cmdHooks(ws, id) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const input = requireFile(p.input);
  const doc = requireFile(p.hooks, 'run `systm scaffold hooks ' + id + '`');
  schemaGate('hooks', doc, 'hooks.json');
  rankHooks(doc);
  const issues = hookIssues(doc, input, cfg);
  const zero = doc.hooks.filter((h) => Object.values(h.scores).every((v) => v === 0)).length;
  const errors = issues.filter((i) => i.severity === 'error');
  if (zero) errors.push({ code: 'HOOKS_UNSCORED', msg: `${zero} hooks have all-zero scores` });
  doc.status = errors.length ? 'needs_revision' : 'ready';
  doc.warnings = issues.filter((i) => i.severity === 'warn').map((i) => `${i.code}: ${i.msg}`);
  doc.provenance = provenance('hooks', [p.input, p.idea]);
  writeJson(p.hooks, doc);
  writeText(p.hooksMd, hooksMd(doc, input));
  const top = [...doc.hooks].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const lines = [`top 3: ${top.map((h) => `${h.id}(${h.total})`).join(' ')} · selected ${doc.selected}`, ...issues.map((i) => `${i.severity.toUpperCase()} ${i.code}: ${i.msg}`), ...(zero ? [`ERROR ${zero} hooks unscored`] : [])];
  return res(errors.length ? 1 : 0, lines, doc);
}

export function cmdMaatpa(ws, id) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const input = requireFile(p.input);
  const doc = requireFile(p.maatpa, 'run `systm scaffold maatpa ' + id + '`');
  schemaGate('maatpa', doc, 'maatpa.json');
  const issues = [...maatpaIssues(doc), ...noveltyConflicts(ws, id, doc, cfg)];
  if (exists(p.idea)) {
    const idea = readJson(p.idea);
    if (idea.mechanic !== doc.mechanic) issues.push({ severity: 'warn', code: 'MECHANIC_MISMATCH', msg: `idea.json says ${idea.mechanic}, maatpa.json says ${doc.mechanic}` });
  }
  const errors = issues.filter((i) => i.severity === 'error');
  doc.status = errors.length ? 'needs_revision' : 'ready';
  doc.warnings = issues.filter((i) => i.severity === 'warn').map((i) => `${i.code}: ${i.msg}`);
  doc.provenance = provenance('maatpa', [p.input, p.hooks]);
  writeJson(p.maatpa, doc);
  writeText(p.maatpaMd, maatpaMd(doc, input));
  const scores = Object.entries(doc.axes).map(([k, v]) => `${k}:${v.score}`).join(' ');
  return res(errors.length ? 1 : 0, [`maatpa ${errors.length ? 'NEEDS REVISION' : 'ok'} · ${scores} · NOVEL_ELEMENT ${doc.novel_element.axis}:${doc.novel_element.key}`, ...issues.map((i) => `${i.severity.toUpperCase()} ${i.code}: ${i.msg}`)], doc);
}

export function cmdScript(ws, id, opts) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const input = requireFile(p.input);
  const doc = requireFile(p.script, 'run `systm scaffold script ' + id + '`');
  schemaGate('script', doc, 'script.json');
  const lines = [];
  if (opts['calibrate-seconds']) {
    const sec = Number(opts['calibrate-seconds']);
    if (!(sec > 5)) throw new CliError('--calibrate-seconds must be the real VO length in seconds');
    const w = doc.beats.reduce((s, b) => s + wordCount(b.vo), 0);
    const pauses = doc.beats.reduce((s, b) => s + (b.pause_after_s ?? 0), 0);
    doc.calibration = { vo_seconds: sec, words: w, wps: Math.round((w / Math.max(1, sec - pauses)) * 1000) / 1000 };
    lines.push(`calibrated: ${w} words in ${sec}s (pauses ${pauses}s) → ${doc.calibration.wps} words/s`);
  }
  doc.status = 'ready';
  doc.provenance = provenance('script', [p.input, p.maatpa, p.hooks]);
  writeJson(p.script, doc);
  const built = buildAll(p, doc, cfg, id);
  writeText(p.scriptMd, scriptMd(doc, built.timing, input));
  const lint = [];
  for (const b of doc.beats) for (const f of lintText(b.vo, { hook: b.n === 1 })) lint.push(`${f.severity.toUpperCase()} beat ${b.n}: ${f.code} "${f.match}"`);
  lines.push(`script ok: ${built.timing.total_s}s est. (${built.timing.total_words} words at ${built.timing.wps}/s, ${built.timing.wps_source})${built.timing.in_target_range ? '' : ' OUTSIDE 60-75s target'}`, ...lint);
  return res(0, lines, built.timing);
}

export function cmdBuild(ws, id) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const script = requireFile(p.script);
  schemaGate('script', script, 'script.json');
  const b = buildAll(p, script, cfg, id);
  const changed = [];
  for (const [file, text] of b.files) if (writeText(file, text)) changed.push(path.relative(p.dir, file));
  return res(0, [`build: ${b.timing.total_frames} frames (${b.timing.total_s}s), ${b.cues.length} caption cues`, changed.length ? `updated: ${changed.join(', ')}` : 'nothing changed (idempotent)'], b.timing);
}

export function cmdVerify(ws, id, opts) {
  const p = epPaths(ws, id);
  const stage = opts.stage === 'release' ? 'release' : 'plan';
  const rep = runChecks(ws, id, { stage });
  writeJson(p.verify, { ...rep, provenance: provenance('verify', [p.input, p.script, p.timing]) });
  writeText(p.verifyMd, verifyMd(rep));
  const lines = rep.checks.map((c) => `${c.status.padEnd(7)} ${c.id.padEnd(5)} ${c.title}${c.details.length && c.status !== 'PASS' ? '\n' + c.details.map((d) => `          · ${d}`).join('\n') : ''}`);
  lines.push(`verdict (${stage}): ${rep.verdict}  ${Object.entries(rep.counts).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  return res(rep.verdict === 'FAIL' ? 1 : rep.verdict === 'BLOCKED' ? 2 : 0, lines, rep);
}

function launchCore(ws, id) {
  const p = epPaths(ws, id);
  const input = requireFile(p.input);
  const product = requireFile(p.product, 'run `systm scaffold product ' + id + '`');
  schemaGate('product', product, 'product.json');
  return { p, product, g: productGate(product, input, p.dir) };
}

function launchWrite(ws, id, { p, g }) {
  writeJson(p.gate, { schema: 'systm/gate@1', episode_id: id, ...g, provenance: provenance('launch', [p.input, p.product, p.script]) });
  const lines = [`release gate: ${g.verdict}`, ...(g.verdict === 'BLOCKED' ? g.missing.map((m) => `  missing: ${m}`) : ['  all gate checks passed'])];
  if (g.verdict === 'BLOCKED') lines.push('  → the CTA must stay honest: cta.type "coming_soon" or "next_request_only", no link, no download words');
  return res(g.verdict === 'BLOCKED' ? 2 : 0, lines, g);
}

export function cmdLaunchSync(ws, id) {
  return launchWrite(ws, id, launchCore(ws, id));
}

export async function cmdLaunch(ws, id, opts) {
  const core = launchCore(ws, id);
  if (opts['check-urls']) {
    const urls = await checkUrls([core.product.hosted_url, core.product.repo_url]);
    core.g.urls = urls;
    for (const u of urls) core.g.checks.push({ id: 'url_reachable', status: u.ok ? 'PASS' : 'FAIL', msg: `${u.url} → ${u.status ?? u.error}` });
    if (urls.some((u) => !u.ok)) { core.g.verdict = 'BLOCKED'; core.g.missing.push('a URL did not answer 2xx/3xx'); }
  }
  return launchWrite(ws, id, core);
}

export function cmdDistribute(ws, id) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  const input = requireFile(p.input);
  const dist = requireFile(p.distribution, 'run `systm scaffold distribution ' + id + '`');
  schemaGate('distribution', dist, 'distribution.json');
  const product = exists(p.product) ? readJson(p.product) : null;
  const gate = product ? productGate(product, input, p.dir) : { verdict: 'BLOCKED', missing: ['product.json missing'], checks: [] };
  const issues = distributionIssues(dist, input, gate, cfg);
  const errors = issues.filter((i) => i.severity === 'error');
  const lines = issues.map((i) => `${i.severity.toUpperCase()} ${i.msg}`);
  if (errors.length) return res(1, ['distribution blocked:', ...lines], issues);
  const approvals = exists(p.approvals) ? readJson(p.approvals) : null;
  dist.status = 'ready';
  dist.provenance = provenance('distribution', [p.script]);
  writeJson(p.distribution, dist);
  const plan = buildPlan(dist, input, product, gate, cfg, id, approvals);
  plan.provenance = provenance('distribute', [p.distribution, p.script, p.input]);
  writeJson(p.plan, plan);
  writeText(p.planMd, planMd(plan, dist));
  writeText(p.utm, utmCsv(plan));
  return res(0, [`publish plan written (dry run, ${plan.items.length} platforms, gate ${plan.gate}). Nothing was posted.`, ...lines], plan);
}

export async function cmdApprove(ws, id, opts) {
  const p = epPaths(ws, id);
  const plan = requireFile(p.plan, 'run `systm distribute ' + id + '`');
  const action = opts.action;
  const item = plan.items.find((i) => i.action === action);
  if (!item) throw new CliError(`--action must be one of: ${plan.items.map((i) => i.action).join(', ')}`);
  if (!opts.by) throw new CliError('--by "<your name>" is required');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new CliError('approval needs a human at an interactive terminal. An agent must not approve its own posts. Run this command yourself (in Claude Code: type ! systm approve ...).', 3);
  console.log(`\nApprove ${action} for ${id}\n\n${JSON.stringify(item.fields, null, 2)}\nlink: ${item.link ?? '(none)'}\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`Type the first 8 characters of the content hash (${item.content_sha256.slice(0, 8)}) to approve: `, r));
  rl.close();
  if (answer.trim() !== item.content_sha256.slice(0, 8)) throw new CliError('hash did not match, nothing approved', 3);
  const doc = exists(p.approvals) ? readJson(p.approvals) : { schema: 'systm/approvals@1', episode_id: id, approvals: [] };
  doc.approvals = doc.approvals.filter((a) => a.action !== action);
  doc.approvals.push({ action, content_sha256: item.content_sha256, approved_by: String(opts.by), approved_at: new Date().toISOString() });
  writeJson(p.approvals, doc);
  return res(0, [`approved ${action}. This only records your approval: the plugin never posts anything itself.`]);
}

export function cmdPackage(ws, id, opts) {
  const p = epPaths(ws, id);
  const cfg = loadConfig(ws);
  if (!exists(p.verify)) throw new CliError('run `systm verify` before packaging');
  const rep = readJson(p.verify);
  if (rep.verdict === 'FAIL') throw new CliError(`verifier says FAIL (${rep.counts.FAIL} checks). Fix them, re-run verify, then package.`, 1);
  const input = readJson(p.input);
  const gate = exists(p.gate) ? readJson(p.gate) : null;
  const timing = readJson(p.timing);
  const files = walk(p.dir, (f) => !f.includes(`${path.sep}package${path.sep}`) && !f.endsWith('.DS_Store'));
  const releaseRep = runChecks(ws, id, { stage: 'release' });
  const reasons = [];
  if (releaseRep.verdict !== 'PASS' && releaseRep.verdict !== 'WARN') reasons.push(`release-stage verifier is ${releaseRep.verdict}`);
  for (const c of releaseRep.checks.filter((k) => k.status === 'FAIL' || k.status === 'BLOCKED')) reasons.push(`${c.id} ${c.title}: ${c.details[0] ?? c.status}`);
  const manifest = {
    schema: 'systm/package@1', episode_id: id, product: input.product, mode: input.status,
    format: cfg.format.width + 'x' + cfg.format.height + '@' + cfg.format.fps, duration_s: timing.total_s, frames: timing.total_frames,
    verifier: { plan: rep.verdict, release: releaseRep.verdict },
    release_gate: gate?.verdict ?? 'NOT_RUN',
    ready_to_publish: releaseRep.verdict !== 'FAIL' && releaseRep.verdict !== 'BLOCKED' && gate?.verdict !== 'BLOCKED',
    blocked_by: reasons,
    files: files.map((f) => ({ file: path.relative(p.dir, f), bytes: fs.statSync(f).size, sha256: sha256(fs.readFileSync(f)) })),
    provenance: provenance('package', [p.script, p.timing, p.verify]),
  };
  writeJson(p.manifest, manifest);
  const lines = [`manifest: ${manifest.files.length} files, ready_to_publish=${manifest.ready_to_publish}`, ...reasons.slice(0, 8).map((r) => `  blocked: ${r}`)];
  if (opts.zip) {
    fs.mkdirSync(ws.out, { recursive: true });
    const zip = path.join(ws.out, `${id}-package.zip`);
    fs.rmSync(zip, { force: true });
    const r = spawnSync('zip', ['-X', '-q', '-r', zip, '.'], { cwd: p.dir, encoding: 'utf8' });
    if (r.status === 0) lines.push(`zip: ${path.relative(ws.base, zip)}`);
    else {
      const tgz = zip.replace(/\.zip$/, '.tar.gz');
      const t = spawnSync('tar', ['-czf', tgz, '-C', p.dir, '.'], { encoding: 'utf8' });
      lines.push(t.status === 0 ? `zip not available, wrote ${path.relative(ws.base, tgz)}` : 'could not create an archive (no zip or tar)');
    }
  }
  return res(0, lines, manifest);
}

export function cmdAnalyze(ws, id, opts) {
  if (!opts.csv) throw new CliError('analyze <EPxxx|all> --csv <file> [--synthetic]');
  const csvFile = path.resolve(opts.csv);
  const synthetic = Boolean(opts.synthetic) || /synthetic/i.test(path.basename(csvFile));
  const a = analyze(fs.readFileSync(csvFile, 'utf8'), { episode: id === 'all' ? null : id, synthetic });
  const lines = [`${a.label} data, ${a.rows} rows, total: ${a.total.views} views → ${a.total.visits} visits → ${a.total.activations} activations → ${a.total.consultations} qualified consultations (${a.total.activations_per_1000_views ?? 'n/a'} activations per 1000 views, confidence ${a.total.confidence})`, ...a.data_issues.map((i) => `DATA ${i}`)];
  if (id !== 'all') {
    const p = epPaths(ws, id);
    writeJson(p.analysis, a);
    writeText(p.analysisMd, analysisMd(a));
    lines.push(`wrote ${path.relative(ws.base, p.analysis)}`);
  }
  return res(a.data_issues.length ? 1 : 0, lines, a);
}

export function cmdQaMedia(ws, file, opts) {
  const cfg = loadConfig(ws);
  let timing = null;
  if (opts.episode) { const p = epPaths(ws, opts.episode); if (exists(p.timing)) timing = readJson(p.timing); }
  const r = qaMedia(path.resolve(file), cfg, { timing, framesDir: opts.frames ? path.resolve(opts.frames) : null });
  return res(r.verdict === 'FAIL' ? 1 : r.verdict === 'BLOCKED' ? 2 : 0, [...r.checks.map((c) => `${c.status.padEnd(7)} ${c.id} ${c.msg}`), `media verdict: ${r.verdict}`], r);
}

export function cmdLint(ws, target) {
  const p = EPISODE_ID.test(target ?? '') ? epPaths(ws, target) : null;
  const texts = [];
  if (p) {
    const s = requireFile(p.script);
    for (const b of s.beats) { texts.push([`beat ${b.n} vo`, b.vo, b.n === 1]); texts.push([`beat ${b.n} overlay`, b.on_screen_text, false]); }
  } else if (target && exists(target)) texts.push([path.basename(target), fs.readFileSync(target, 'utf8'), false]);
  else throw new CliError('lint <EPxxx|file>');
  const lines = [];
  let errs = 0;
  for (const [where, t, hook] of texts) for (const f of lintText(t, { hook })) { lines.push(`${f.severity.toUpperCase().padEnd(5)} ${where}: ${f.code} "${f.match}" ${f.message}`); if (f.severity === 'error') errs++; }
  lines.push(lines.length ? `${errs} errors` : 'clean');
  return res(errs ? 1 : 0, lines);
}

export function cmdStatus(ws, id) {
  if (!id) {
    const eps = listEpisodes(ws);
    const bl = loadBacklog(ws);
    return res(0, [`workspace ${ws.dir}`, `episodes: ${eps.join(' ') || 'none'}`, `backlog: ${bl.items.filter((i) => i.status === 'queued').length} queued, ${bl.items.length} total`, `requests: ${loadRequests(ws).length}`]);
  }
  const p = epPaths(ws, id);
  const st = stageStatus(p);
  const lines = st.map((s) => `${s.state.padEnd(15)} ${s.stage.padEnd(13)} ${s.file}${s.detail ? `  (${s.detail})` : ''}`);
  const first = st.find((s) => s.state !== 'ok' && !['product', 'launch', 'distribution', 'distribute', 'package'].includes(s.stage)) ?? st.find((s) => s.state !== 'ok');
  const next = { input: 'systm new', idea: 'systm-idea-lab', hooks: 'systm-hook-lab', maatpa: 'systm-maatpa-director', script: 'systm-scriptwriter', build: 'systm build', verify: 'systm verify', package: 'systm package', distribution: 'systm-distributor', distribute: 'systm distribute', product: 'systm-product-launch', launch: 'systm launch' };
  lines.push(first ? `next: ${next[first.stage]} (${first.stage} is ${first.state})` : 'all stages are ok');
  return res(0, lines, st);
}

// ---- audit (the 12 acceptance tests) -------------------------------------------------------

export function pluginChecks(root, { runTests = false } = {}) {
  const out = [];
  const repo = path.resolve(root, '..', '..');
  const pass = (id, status, msg) => out.push({ id, status, msg });
  const j = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { __err: e.message }; } };
  const cc = j(path.join(root, '.claude-plugin', 'plugin.json'));
  const cx = j(path.join(root, '.codex-plugin', 'plugin.json'));
  const errs = [];
  if (cc.__err) errs.push(`.claude-plugin/plugin.json: ${cc.__err}`);
  if (cx.__err) errs.push(`.codex-plugin/plugin.json: ${cx.__err}`);
  if (!errs.length) {
    if (cc.name !== cx.name) errs.push('plugin name differs between claude and codex manifests');
    if (cc.version !== cx.version) errs.push('plugin version differs between claude and codex manifests');
    if (!cx.interface?.displayName || !cx.interface?.shortDescription) errs.push('codex manifest needs interface.displayName and shortDescription');
    if (!String(cx.skills ?? '').startsWith('./')) errs.push('codex skills path must start with ./');
  }
  const skillsDir = path.join(root, 'skills');
  const skills = exists(skillsDir) ? fs.readdirSync(skillsDir).filter((d) => exists(path.join(skillsDir, d, 'SKILL.md'))) : [];
  for (const s of skills) {
    const txt = fs.readFileSync(path.join(skillsDir, s, 'SKILL.md'), 'utf8');
    const fm = txt.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fm) { errs.push(`${s}: no frontmatter`); continue; }
    const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const rawDesc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    let desc = rawDesc;
    if (rawDesc?.startsWith('"')) { try { desc = JSON.parse(rawDesc); } catch { errs.push(`${s}: description is not a valid quoted string`); } }
    else if (rawDesc && /:\s/.test(rawDesc)) errs.push(`${s}: unquoted description contains ": " and is invalid YAML, wrap it in double quotes`);
    if (name !== s) errs.push(`${s}: frontmatter name "${name}" must equal the folder name`);
    if (!/^[a-z0-9-]{1,64}$/.test(s)) errs.push(`${s}: skill folder must be lowercase-hyphen`);
    if (!desc) errs.push(`${s}: missing description`);
    else if (desc.length > 1024) errs.push(`${s}: description is ${desc.length} chars (limit 1024)`);
  }
  if (skills.length < 10) errs.push(`only ${skills.length} skills found`);
  for (const dir of ['commands', 'agents']) {
    const d = path.join(root, dir);
    if (!exists(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md'))) {
      const t = fs.readFileSync(path.join(d, f), 'utf8');
      if (!/^---\n[\s\S]*?description:\s*\S/.test(t)) errs.push(`${dir}/${f}: missing frontmatter description`);
      for (const line of (t.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').split('\n')) {
        const [, k, v] = line.match(/^([\w-]+):\s*(.*)$/) ?? [];
        if (v && !v.startsWith('"') && /:\s|^[\[<|>&*!%@`]/.test(v)) errs.push(`${dir}/${f}: "${k}" value needs double quotes to be valid YAML`);
      }
    }
  }
  const mp = [[path.join(repo, '.claude-plugin', 'marketplace.json'), 'claude'], [path.join(repo, '.agents', 'plugins', 'marketplace.json'), 'codex']];
  for (const [f, k] of mp) {
    if (!exists(f)) { errs.push(`${k} marketplace missing at ${path.relative(repo, f)}`); continue; }
    const m = j(f);
    if (m.__err) { errs.push(`${k} marketplace: ${m.__err}`); continue; }
    for (const pl of m.plugins ?? []) {
      const src = typeof pl.source === 'string' ? pl.source : pl.source?.path;
      if (!src || !exists(path.resolve(repo, src))) errs.push(`${k} marketplace: source ${src} does not exist`);
    }
  }
  for (const f of fs.readdirSync(path.join(root, 'schemas'))) if (j(path.join(root, 'schemas', f)).__err) errs.push(`schemas/${f} is not valid JSON`);
  pass('structure', errs.length ? 'FAIL' : 'PASS', errs.length ? errs.join('; ') : `${skills.length} skills, claude+codex manifests agree, both marketplaces resolve`);

  const cl = spawnSync('claude', ['plugin', 'validate', root], { encoding: 'utf8' });
  if (cl.error) pass('claude_validate', 'BLOCKED', '`claude` is not installed here, so the manifest was not validated against a Claude Code version');
  else pass('claude_validate', cl.status === 0 ? 'PASS' : 'FAIL', `${spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim()}: ${(cl.stdout + cl.stderr).trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`);

  const readme = path.join(repo, 'README.md');
  const rt = exists(readme) ? fs.readFileSync(readme, 'utf8') : '';
  const need = { install: /(^|\n)#+[^\n]*(התקנה|install)/i, run: /(^|\n)#+[^\n]*(הרצה|שימוש|usage|run)/i, troubleshoot: /(^|\n)#+[^\n]*(פתרון תקלות|troubleshoot)/i, limitations: /(^|\n)#+[^\n]*(מגבלות|limitations)/i };
  const miss = Object.entries(need).filter(([, re]) => !re.test(rt)).map(([k]) => k);
  pass('readme', miss.length ? 'FAIL' : 'PASS', miss.length ? `README missing sections: ${miss.join(', ')}` : 'README has install, run, troubleshoot and limitations');

  const st = selfTest(root);
  pass('sample_reproducible', st.ok ? 'PASS' : 'FAIL', st.ok ? `EP001 sample regenerates byte-identically (${st.files} files)` : `sample drift: ${st.diffs.slice(0, 5).join('; ')}`);
  if (runTests) {
    const t = spawnSync(process.execPath, ['--test', path.join(root, 'tests', '*.test.mjs')], { encoding: 'utf8' });
    const m = (t.stdout ?? '').match(/# pass (\d+)[\s\S]*?# fail (\d+)/);
    pass('unit_tests', t.status === 0 ? 'PASS' : 'FAIL', m ? `${m[1]} passed, ${m[2]} failed` : (t.stderr || t.stdout).slice(0, 200));
  } else pass('unit_tests', 'BLOCKED', 'not run: pass --run-tests (or run `npm test`)');
  return out;
}

export function cmdAudit(ws, id, opts) {
  const lines = [];
  let worst = 'PASS';
  const rank = { PASS: 0, WARN: 1, BLOCKED: 2, FAIL: 3 };
  const bump = (s) => { if (rank[s] > rank[worst]) worst = s; };
  const data = {};
  if (id) {
    const rep = runChecks(ws, id, { stage: opts.stage === 'release' ? 'release' : 'plan' });
    data.episode = rep;
    for (const c of rep.checks) { lines.push(`${c.status.padEnd(7)} ${c.id.padEnd(4)} [acc ${c.acceptance}] ${c.title}${c.status !== 'PASS' ? '\n' + c.details.slice(0, 4).map((d) => `          · ${d}`).join('\n') : ''}`); bump(c.status); }
  }
  if (opts.plugin || !id) {
    const pc = pluginChecks(PLUGIN_ROOT, { runTests: Boolean(opts['run-tests']) });
    data.plugin = pc;
    const acc = { claude_validate: 11, structure: 11, readme: 12, sample_reproducible: 10, unit_tests: 10 };
    for (const c of pc) { lines.push(`${c.status.padEnd(7)} ${c.id.padEnd(20)} [acc ${acc[c.id]}] ${c.msg}`); bump(c.status); }
  }
  lines.push(`audit verdict: ${worst}`);
  return res(worst === 'FAIL' ? 1 : worst === 'BLOCKED' ? 2 : 0, lines, data);
}

// ---- reproducibility self-test -------------------------------------------------------------

const AUTHORED = ['input.json', 'idea.json', 'hooks.json', 'maatpa.json', 'script.json', 'distribution.json', 'product.json'];

export function runPipeline(ws, id) {
  const out = [];
  for (const [name, fn] of [['idea', () => cmdIdea(ws, id)], ['hooks', () => cmdHooks(ws, id)], ['maatpa', () => cmdMaatpa(ws, id)], ['script', () => cmdScript(ws, id, {})], ['build', () => cmdBuild(ws, id)]]) {
    out.push([name, fn()]);
  }
  return out;
}

export function selfTest(root) {
  const sample = path.join(root, 'examples', 'workspace');
  const id = 'EP001';
  const src = path.join(sample, 'systm');
  if (!exists(src)) return { ok: false, diffs: ['examples/workspace missing'], files: 0 };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'systm-selftest-'));
  try {
    const ws = workspace(tmp);
    fs.mkdirSync(path.join(ws.episodes, id), { recursive: true });
    fs.mkdirSync(ws.series, { recursive: true });
    fs.copyFileSync(path.join(src, 'config.json'), ws.config);
    for (const f of fs.readdirSync(path.join(src, 'series'))) fs.copyFileSync(path.join(src, 'series', f), path.join(ws.series, f));
    for (const f of AUTHORED) fs.copyFileSync(path.join(src, 'episodes', id, f), path.join(ws.episodes, id, f));
    const steps = runPipeline(ws, id);
    const bad = steps.find(([, r]) => r.exit !== 0);
    if (bad) return { ok: false, diffs: [`step ${bad[0]} failed: ${bad[1].lines.slice(0, 2).join(' / ')}`], files: 0 };
    const p = epPaths(ws, id);
    cmdVerify(ws, id, {});
    cmdLaunchSync(ws, id);
    const dr = cmdDistribute(ws, id);
    if (dr.exit !== 0) return { ok: false, diffs: [`distribute failed: ${dr.lines.slice(0, 2).join(' / ')}`], files: 0 };
    cmdPackage(ws, id, {});
    cmdAnalyze(ws, id, { csv: path.join(root, 'examples', 'analytics_SYNTHETIC.csv') });
    const diffs = [];
    let files = 0;
    const want = path.join(src, 'episodes', id);
    for (const f of walk(want)) {
      const rel = path.relative(want, f);
      const got = path.join(p.dir, rel);
      files++;
      if (!exists(got)) diffs.push(`${rel} not regenerated`);
      else if (fs.readFileSync(got, 'utf8') !== fs.readFileSync(f, 'utf8')) diffs.push(`${rel} differs`);
    }
    return { ok: diffs.length === 0, diffs, files };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function cmdSelftest() {
  const r = selfTest(PLUGIN_ROOT);
  return res(r.ok ? 0 : 1, [r.ok ? `sample reproducible: ${r.files} files identical` : `sample drift:\n${r.diffs.map((d) => `  ${d}`).join('\n')}`], r);
}
