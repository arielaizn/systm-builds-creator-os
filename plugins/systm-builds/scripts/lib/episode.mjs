import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, EPISODE_ID } from './model.mjs';
import { CliError, VERSION, contentHash, exists, readJson, writeJson } from './util.mjs';
import { check } from './schema.mjs';

export function workspace(root) {
  const base = path.resolve(root ?? process.env.SYSTM_ROOT ?? process.cwd());
  const dir = path.join(base, 'systm');
  return { base, dir, config: path.join(dir, 'config.json'), series: path.join(dir, 'series'), episodes: path.join(dir, 'episodes'), out: path.join(dir, 'out') };
}

export function loadConfig(ws) {
  const cfg = exists(ws.config) ? readJson(ws.config) : {};
  const merge = (a, b) => {
    const o = { ...a };
    for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v;
    return o;
  };
  return merge(DEFAULT_CONFIG, cfg);
}

export function assertId(id) {
  if (!EPISODE_ID.test(id ?? '')) throw new CliError(`Episode id must look like EP001, got "${id}"`);
  return id;
}

export function epPaths(ws, id) {
  assertId(id);
  const dir = path.join(ws.episodes, id);
  const f = (...p) => path.join(dir, ...p);
  return {
    dir,
    input: f('input.json'), idea: f('idea.json'), hooks: f('hooks.json'), hooksMd: f('hooks.md'),
    maatpa: f('maatpa.json'), maatpaMd: f('maatpa.md'), script: f('script.json'), scriptMd: f('script.md'),
    timing: f('build', 'timing.json'), vo: f('build', 'vo.txt'), shotlist: f('build', 'shotlist.csv'), edl: f('build', 'edl.csv'),
    srt: f('build', 'captions.he.srt'), vtt: f('build', 'captions.he.vtt'), cues: f('build', 'sound-cues.csv'),
    motion: f('build', 'motion-props.json'),
    verify: f('verify', 'report.json'), verifyMd: f('verify', 'report.md'),
    manifest: f('package', 'manifest.json'),
    distribution: f('distribution.json'), plan: f('distribute', 'plan.json'), planMd: f('distribute', 'plan.md'), utm: f('distribute', 'utm.csv'),
    product: f('product.json'), gate: f('launch', 'gate.json'),
    approvals: f('approvals.json'),
    analysis: f('analytics', 'analysis.json'), analysisMd: f('analytics', 'analysis.md'),
  };
}

export function requireFile(file, hint) {
  if (!exists(file)) throw new CliError(`Missing ${path.basename(file)}${hint ? `. ${hint}` : ''}`);
  return readJson(file);
}

export function loadValidated(file, schemaName, hint) {
  const data = requireFile(file, hint);
  const errors = check(schemaName, data);
  return { data, errors };
}

// Stage order. Each stage lists the files whose content it was derived from.
export function stageGraph(p) {
  return [
    { stage: 'input', file: p.input, needs: [] },
    { stage: 'idea', file: p.idea, needs: [p.input] },
    { stage: 'hooks', file: p.hooks, needs: [p.input, p.idea] },
    { stage: 'maatpa', file: p.maatpa, needs: [p.input, p.hooks] },
    { stage: 'script', file: p.script, needs: [p.input, p.maatpa, p.hooks] },
    { stage: 'build', file: p.timing, needs: [p.script] },
    { stage: 'verify', file: p.verify, needs: [p.input, p.script, p.timing] },
    { stage: 'package', file: p.manifest, needs: [p.script, p.timing, p.verify] },
    { stage: 'distribution', file: p.distribution, needs: [p.script] },
    { stage: 'distribute', file: p.plan, needs: [p.distribution, p.script, p.input] },
    { stage: 'product', file: p.product, needs: [] },
    { stage: 'launch', file: p.gate, needs: [p.input, p.product, p.script] },
  ];
}

export function provenance(stage, inputs, extra = {}) {
  return {
    stage,
    tool: `systm@${VERSION}`,
    inputs: inputs.filter(exists).map((f) => ({ file: path.basename(f), sha256: contentHash(f) })),
    ...extra,
  };
}

export function stamp(file, stage, inputs) {
  const obj = readJson(file);
  obj.provenance = provenance(stage, inputs);
  writeJson(file, obj);
  return obj;
}

export function stageStatus(p) {
  return stageGraph(p).map((s) => {
    if (!exists(s.file)) return { stage: s.stage, state: 'missing', file: path.relative(p.dir, s.file) };
    let state = 'ok';
    let detail = '';
    try {
      const obj = s.file.endsWith('.json') ? readJson(s.file) : null;
      const prov = obj?.provenance;
      if (obj?.status && ['needs_revision', 'blocked'].includes(obj.status)) { state = obj.status; }
      if (prov?.inputs) {
        for (const i of prov.inputs) {
          const f = s.needs.find((n) => path.basename(n) === i.file);
          if (f && contentHash(f) !== i.sha256) { state = 'stale'; detail = `upstream ${i.file} changed`; break; }
        }
      }
    } catch (e) { state = 'unreadable'; detail = e.message; }
    return { stage: s.stage, state, file: path.relative(p.dir, s.file), detail };
  });
}

export function listEpisodes(ws) {
  if (!exists(ws.episodes)) return [];
  return fs.readdirSync(ws.episodes).filter((d) => EPISODE_ID.test(d)).sort();
}
