import fs from 'node:fs';
import path from 'node:path';
import { AXES, BEATS, HOOK_DIMS, HOOK_WEIGHTS, NOVELTY, VIEWER_QUESTION_AT } from './model.mjs';
import { exists, readJson, round, wordCount, mmss } from './util.mjs';
import { lintText } from './he.mjs';
import { listEpisodes, epPaths } from './episode.mjs';

// ---- hooks ---------------------------------------------------------------------------------

export function rankHooks(doc) {
  const wsum = Object.values(HOOK_WEIGHTS).reduce((a, b) => a + b, 0);
  for (const h of doc.hooks) {
    h.total = round(HOOK_DIMS.reduce((s, d) => s + h.scores[d] * HOOK_WEIGHTS[d], 0) / wsum, 2);
  }
  const order = [...doc.hooks].sort((a, b) => b.total - a.total || b.scores.proof - a.scores.proof || b.scores.curiosity - a.scores.curiosity || a.id.localeCompare(b.id));
  order.forEach((h, i) => { h.rank = i + 1; });
  return doc;
}

export function hookIssues(doc, input, cfg) {
  const issues = [];
  const ids = new Set(doc.hooks.map((h) => h.id));
  if (ids.size !== doc.hooks.length) issues.push({ severity: 'error', code: 'HOOK_DUP_ID', msg: 'duplicate hook ids' });
  const evIds = new Set((input.evidence ?? []).map((e) => e.id));
  for (const h of doc.hooks) {
    const n = wordCount(h.text);
    if (n > cfg.voice.hook_max_words) issues.push({ severity: 'warn', code: 'HOOK_TOO_LONG', msg: `${h.id} has ${n} words, over ${cfg.voice.hook_max_words} (3 seconds)` });
    for (const f of lintText(h.text, { hook: true })) if (f.severity === 'error') issues.push({ severity: 'error', code: f.code, msg: `${h.id}: ${f.message} "${f.match}"` });
    for (const e of h.provable_with ?? []) if (!evIds.has(e)) issues.push({ severity: 'error', code: 'HOOK_BAD_EVIDENCE', msg: `${h.id} points at unknown evidence ${e}` });
  }
  const sel = doc.hooks.find((h) => h.id === doc.selected);
  if (!sel) issues.push({ severity: 'error', code: 'HOOK_SELECTED_MISSING', msg: `selected ${doc.selected} is not among the 12 hooks` });
  else {
    if (sel.scores.proof < 3) issues.push({ severity: 'error', code: 'HOOK_UNPROVABLE', msg: `selected hook ${sel.id} has proof ${sel.scores.proof} (<3): it cannot be shown on screen` });
    if (!(sel.provable_with ?? []).length) issues.push({ severity: 'error', code: 'HOOK_NO_EVIDENCE', msg: `selected hook ${sel.id} lists no evidence in provable_with` });
    const best = [...doc.hooks].sort((a, b) => b.total - a.total)[0];
    if (best.id !== sel.id && best.total - sel.total >= 0.5) issues.push({ severity: 'warn', code: 'HOOK_NOT_TOP', msg: `selected ${sel.id} (${sel.total}) is well below top-ranked ${best.id} (${best.total}); say why in note` });
  }
  return issues;
}

// ---- maatpa --------------------------------------------------------------------------------

export function maatpaIssues(doc) {
  const issues = [];
  for (const a of AXES) {
    const ax = doc.axes[a.key];
    if (ax.score < 3) issues.push({ severity: 'error', code: 'AXIS_BELOW_3', msg: `${a.name} (${a.key}) scored ${ax.score}: revise before moving on` });
  }
  const ne = doc.novel_element;
  const known = NOVELTY[ne.axis] ?? [];
  if (!known.includes(ne.key) && !ne.key.startsWith('custom:')) issues.push({ severity: 'error', code: 'NOVELTY_UNKNOWN', msg: `NOVEL_ELEMENT key "${ne.key}" is not in the ${ne.axis} catalogue (${known.join(', ')}). Use one of them or prefix with "custom:"` });
  const got = doc.viewer_questions.map((q) => q.at_s).sort((a, b) => a - b).join(',');
  if (got !== VIEWER_QUESTION_AT.join(',')) issues.push({ severity: 'error', code: 'VIEWER_Q_TIMES', msg: `viewer questions must sit at ${VIEWER_QUESTION_AT.join('/')}s` });
  return issues;
}

export function noveltyConflicts(ws, id, doc, cfg) {
  const out = [];
  const eps = listEpisodes(ws).filter((e) => e !== id).sort();
  const recent = eps.slice(-cfg.novelty.no_repeat_window);
  const mine = `${doc.novel_element.axis}:${doc.novel_element.key}`;
  for (const e of eps) {
    const f = epPaths(ws, e).maatpa;
    if (!exists(f)) continue;
    try {
      const o = readJson(f);
      const theirs = `${o.novel_element?.axis}:${o.novel_element?.key}`;
      if (theirs === mine) out.push({ severity: recent.includes(e) ? 'error' : 'warn', code: 'NOVELTY_REPEAT', msg: `${e} already used NOVEL_ELEMENT ${mine}${recent.includes(e) ? ' (inside the no-repeat window)' : ''}` });
    } catch { /* unreadable sibling episode is reported by status */ }
  }
  return out;
}

// ---- markdown renders ----------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function hooksMd(doc, input) {
  const rows = [...doc.hooks].sort((a, b) => a.rank - b.rank).map((h) => `| ${h.rank} | ${h.id}${h.id === doc.selected ? ' ✔' : ''} | ${esc(h.text)} | ${h.type} | ${HOOK_DIMS.map((d) => h.scores[d]).join(' / ')} | ${h.total} | ${(h.provable_with ?? []).join(' ')} |`);
  return `# ${input.episode_id} · 12 הוקים מדורגים\n\nמשקלים: ${Object.entries(HOOK_WEIGHTS).map(([k, v]) => `${k} ×${v}`).join(' · ')}\nסדר הציונים: ${HOOK_DIMS.join(' / ')}\n\n| דירוג | מזהה | הוק | סוג | ציונים | סה"כ | הוכחה |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nנבחר: **${doc.selected}**\n`;
}

export function maatpaMd(doc, input) {
  const blocks = AXES.map((a) => {
    const x = doc.axes[a.key];
    return `## ${a.letter} · ${a.name}  (${x.score}/5)\n\n- בחירה: ${x.choice}\n- למה: ${x.why}\n- זמן: ${x.timestamp}\n- נכס: ${x.asset}\n- מימוש: ${x.implementation}\n- סיכון: ${x.risk}\n- מדד: ${x.metric}\n- תיקון אם נכשל: ${x.repair}`;
  });
  const q = doc.viewer_questions.slice().sort((a, b) => a.at_s - b.at_s).map((v) => `- ${v.at_s}s: ${v.question}`).join('\n');
  return `# ${input.episode_id} · מעטפ״ה\n\nמנגנון יחיד: **${doc.mechanic}**\n\n**NOVEL_ELEMENT**: ${doc.novel_element.axis} / ${doc.novel_element.key}. ${doc.novel_element.description}\n\n${blocks.join('\n\n')}\n\n## שאלות פתוחות אצל הצופה\n\n${q}\n`;
}

export function scriptMd(script, timing, input) {
  const ev = new Map((input.evidence ?? []).map((e) => [e.id, e]));
  const rows = timing.beats.map((r) => {
    const b = script.beats.find((x) => x.n === r.n);
    return `| ${r.n} | ${r.name} | ${mmss(r.start_s)}–${mmss(r.end_s)} | ${esc(b.vo)} | ${esc(b.on_screen_text)} | ${b.mode} | ${esc(b.asset)} | ${esc(b.sound_cue)} | ${esc(b.viewer_question)} | ${(b.evidence ?? []).join(' ')} | ${esc(b.transition)} |`;
  });
  const ledger = (input.evidence ?? []).map((e) => `| ${e.id} | ${e.kind} | ${esc(e.description)} | ${e.state}${e.synthetic ? ' · סינתטי' : ''} | ${esc(e.ref ?? '')} |`);
  const claims = (script.claims ?? []).map((c) => `| ${c.id} | beat ${c.beat} | ${c.type} | ${esc(c.text)} | ${c.evidence.map((i) => `${i}(${ev.get(i)?.state ?? '?'})`).join(' ')} |`);
  const vo = timing.beats.map((r) => script.beats.find((x) => x.n === r.n).vo).filter((s) => s?.trim()).join('\n\n');
  return `# ${input.episode_id} · ${input.product}\n\nמצב: ${input.status} · קהל: ${input.audience} · כאב: ${input.pain}\nמשך מוערך: ${timing.total_s}s (${timing.total_frames} פריימים, ${timing.wps} מילים/שנייה, ${timing.wps_source})\n\n## 13 ביטים\n\n| # | ביט | זמן | VO | על המסך | מצב | נכס | סאונד | שאלת צופה | ראיות | מעבר |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## VO רציף\n\n${vo}\n\n## ספר ראיות\n\n| מזהה | סוג | תיאור | מצב | מקור |\n|---|---|---|---|---|\n${ledger.join('\n') || '| | | (ריק) | | |'}\n\n## טענות\n\n| מזהה | ביט | סוג | טענה | ראיות |\n|---|---|---|---|---|\n${claims.join('\n') || '| | | | (אין טענות מוצהרות) | |'}\n\n## קריאה לפעולה\n\nסוג: ${script.cta.type}${script.cta.giveaway ? `\nמתנה: ${script.cta.giveaway}` : ''}\nהבקשה הבאה: ${script.cta.next_request}\n`;
}

export function scaffold(stage, id, input) {
  const base = { schema: `systm/${stage}@1`, episode_id: id, status: 'draft', warnings: [], evidence_refs: [] };
  if (stage === 'idea') {
    return { ...base, one_product: input?.product ?? '', one_test: '', business_pain: input?.pain ?? '', mechanic: 'duplicate_lead',
      consent: { required: input?.origin === 'consented_request', state: input?.origin === 'consented_request' ? 'pending' : 'not_needed', note: '' },
      novel_candidates: [{ axis: 'mechanism', key: 'duplicate_record', why: '' }], rejected_ideas: [], risks: [] };
  }
  if (stage === 'hooks') {
    const z = { audience_fit: 0, curiosity: 0, specificity: 0, proof: 0, visual_strength: 0 };
    return { ...base, hooks: Array.from({ length: 12 }, (_, i) => ({ id: `H${String(i + 1).padStart(2, '0')}`, text: '', type: 'result_first', scores: { ...z }, provable_with: [], note: '' })), selected: 'H01' };
  }
  if (stage === 'maatpa') {
    const ax = () => ({ choice: '', why: '', timestamp: '', asset: '', implementation: '', risk: '', metric: '', repair: '', score: 0 });
    return { ...base, mechanic: 'duplicate_lead', axes: Object.fromEntries(AXES.map((a) => [a.key, ax()])),
      novel_element: { axis: 'mechanism', key: 'duplicate_record', description: '' },
      viewer_questions: VIEWER_QUESTION_AT.map((at_s) => ({ at_s, question: '' })) };
  }
  if (stage === 'script') {
    return { ...base,
      beats: BEATS.map((b) => ({ n: b.n, vo: '', on_screen_text: '', mode: b.mode, asset: '', framing: '', action: '', sound_cue: '', viewer_question: '', evidence: [], transition: '' })),
      claims: [], sound: [], cta: { type: 'next_request_only', next_request: '' }, synthetic_label: '' };
  }
  if (stage === 'distribution') {
    return { ...base, platforms: { instagram: { caption: '', story_teaser: '' }, tiktok: { caption: '' }, shorts: { title: '', description: '' }, linkedin: { caption: '' } },
      thumbnail_text: '', alt_text: '', ab_hooks: [{ id: 'H01', text: '' }, { id: 'H02', text: '' }], link_policy: 'library_link', dm: { integration_verified: false } };
  }
  if (stage === 'product') {
    return { schema: 'systm/product@1', name: input?.product ?? '', status: input?.status ?? 'PROTOTYPE', version: '', capabilities: [], hosted_url: null, repo_url: null, license: null,
      install: '', quotas: '', costs: { hosting: '', api: '', third_party: '' }, privacy: '', known_issues: [], support: '', screenshots: [], free_forever_claim: false };
  }
  throw new Error(`No scaffold for ${stage}`);
}
