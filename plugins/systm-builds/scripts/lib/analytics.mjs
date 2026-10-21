import { parseCsv } from './csv.mjs';
import { round } from './util.mjs';

const num = (v) => (v === '' || v === undefined ? null : Number(v));

// Wilson score interval, 95%.
export function wilson(k, n) {
  if (!n) return null;
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: round(Math.max(0, (c - m) / d), 4), hi: round(Math.min(1, (c + m) / d), 4) };
}

const FUNNEL = ['views', 'visits', 'activations', 'consultations'];

export function analyze(csvText, { episode = null, synthetic = false } = {}) {
  const raw = parseCsv(csvText);
  const issues = [];
  let rows = raw.map((r, i) => ({ line: i + 2, date: r.date, platform: (r.platform ?? 'all').toLowerCase(), episode_id: r.episode_id, ...Object.fromEntries(FUNNEL.map((k) => [k, num(r[k])])), avg_view_duration_s: num(r.avg_view_duration_s) }));
  for (const r of rows) {
    for (const k of FUNNEL) if (r[k] === null || Number.isNaN(r[k]) || r[k] < 0) issues.push(`line ${r.line}: ${k} is missing or negative`);
    if (r.visits > r.views) issues.push(`line ${r.line}: visits (${r.visits}) exceed views (${r.views}), check the export`);
    if (r.activations > r.visits) issues.push(`line ${r.line}: activations (${r.activations}) exceed visits (${r.visits})`);
    if (r.consultations > r.activations) issues.push(`line ${r.line}: qualified consultations exceed activations`);
  }
  if (episode) rows = rows.filter((r) => !r.episode_id || r.episode_id === episode);
  const clean = rows.filter((r) => FUNNEL.every((k) => Number.isFinite(r[k])));
  const group = (key) => {
    const m = new Map();
    for (const r of clean) {
      const g = m.get(r[key]) ?? { key: r[key], views: 0, visits: 0, activations: 0, consultations: 0 };
      for (const k of FUNNEL) g[k] += r[k];
      m.set(r[key], g);
    }
    return [...m.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  };
  const rate = (a, b) => (b ? round(a / b, 4) : null);
  const enrich = (g) => ({
    ...g,
    visit_rate: rate(g.visits, g.views), visit_rate_ci: wilson(g.visits, g.views),
    activation_rate: rate(g.activations, g.visits), activation_rate_ci: wilson(g.activations, g.visits),
    consult_rate: rate(g.consultations, g.activations), consult_rate_ci: wilson(g.consultations, g.activations),
    activations_per_1000_views: g.views ? round((g.activations / g.views) * 1000, 2) : null,
    consultations_per_1000_views: g.views ? round((g.consultations / g.views) * 1000, 3) : null,
    confidence: g.views < 1000 ? 'very_low' : g.visits < 100 ? 'low' : g.activations < 30 ? 'low' : 'usable',
  });
  const total = enrich(clean.reduce((a, r) => { for (const k of FUNNEL) a[k] += r[k]; return a; }, { key: 'all', views: 0, visits: 0, activations: 0, consultations: 0 }));
  const byPlatform = group('platform').map(enrich);
  const notes = [
    'Headline metrics are activations and qualified consultations per 1,000 views. Views alone are not a result.',
    'Rates carry Wilson 95% intervals. If two intervals overlap, the difference is not shown by this data.',
    'No causal claims: this file cannot say a hook, a novelty element or a platform caused a difference.',
  ];
  if (total.confidence !== 'usable') notes.push(`Sample is ${total.confidence}: ${total.views} views, ${total.visits} visits, ${total.activations} activations. Do not change the format on this alone.`);
  if (synthetic) notes.unshift('SYNTHETIC DATA: invented to test the pipeline, never quote it as a result.');
  return { schema: 'systm/analysis@1', episode_id: episode, label: synthetic ? 'SYNTHETIC' : 'REAL', rows: clean.length, data_issues: issues, total, by_platform: byPlatform, notes };
}

export function analysisMd(a) {
  const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  const ci = (c) => (c ? `${(c.lo * 100).toFixed(1)}–${(c.hi * 100).toFixed(1)}%` : 'n/a');
  const row = (g) => `| ${g.key} | ${g.views} | ${g.visits} | ${g.activations} | ${g.consultations} | ${pct(g.visit_rate)} (${ci(g.visit_rate_ci)}) | ${pct(g.activation_rate)} (${ci(g.activation_rate_ci)}) | ${g.activations_per_1000_views ?? 'n/a'} | ${g.confidence} |`;
  return `# ${a.episode_id ?? 'סדרה'} · אנליטיקס${a.label === 'SYNTHETIC' ? ' · נתונים סינתטיים' : ''}\n\n| פלטפורמה | צפיות | ביקורים | הפעלות | ייעוצים מוסמכים | ביקור/צפייה | הפעלה/ביקור | הפעלות ל-1000 צפיות | ביטחון |\n|---|---|---|---|---|---|---|---|---|\n${[a.total, ...a.by_platform].map(row).join('\n')}\n\n${a.data_issues.length ? `## בעיות בנתונים\n\n${a.data_issues.map((x) => `- ${x}`).join('\n')}\n\n` : ''}## הערות\n\n${a.notes.map((n) => `- ${n}`).join('\n')}\n`;
}
