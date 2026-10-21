import { toCsv } from './csv.mjs';
import { lintText } from './he.mjs';
import { sha256, wordCount } from './util.mjs';
import { claimHits, distributionTexts, giveawayOffenders } from './scan.mjs';


export function utmUrl(base, cfg, platform, id, hookId, keyword) {
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set('utm_source', cfg.utm.source_by_platform[platform] ?? platform);
  u.searchParams.set('utm_medium', cfg.utm.medium);
  u.searchParams.set('utm_campaign', id.toLowerCase());
  u.searchParams.set('utm_content', hookId);
  if (keyword) u.searchParams.set('utm_term', keyword);
  return u.toString();
}

export function distributionIssues(dist, input, gate, cfg, script = null) {
  const issues = [];
  const lim = cfg.platform_limits;
  const P = dist.platforms;
  const len = (what, text, max) => { if (text.length > max) issues.push({ severity: 'error', msg: `${what} is ${text.length} chars, platform limit ${max} (verify the current limit)` }); };
  len('instagram caption', P.instagram.caption, lim.instagram_caption);
  len('tiktok caption', P.tiktok.caption, lim.tiktok_caption);
  len('shorts title', P.shorts.title, lim.shorts_title);
  len('shorts description', P.shorts.description, lim.shorts_description);
  len('linkedin caption', P.linkedin.caption, lim.linkedin_caption);
  if (wordCount(dist.thumbnail_text) > lim.thumbnail_words) issues.push({ severity: 'warn', msg: `thumbnail text has ${wordCount(dist.thumbnail_text)} words, keep it under ${lim.thumbnail_words + 1}` });
  const texts = { instagram: `${P.instagram.caption} ${P.instagram.story_teaser}`, tiktok: P.tiktok.caption, shorts: `${P.shorts.title} ${P.shorts.description}`, linkedin: P.linkedin.caption };
  const all = distributionTexts(dist);
  if (gate.verdict === 'BLOCKED') {
    for (const t of all) for (const sent of giveawayOffenders(t.text)) issues.push({ severity: 'error', msg: `${t.where} offers access while the release gate is blocked: "${sent.slice(0, 70)}"` });
  }
  for (const t of all) {
    for (const h of claimHits(t.text)) {
      if (!script || !(script.claims ?? []).some((c) => c.type === h.type)) issues.push({ severity: 'error', msg: `${t.where} says "${h.match}" (${h.type}) and the script has no ${h.type} claim backing it` });
    }
  }
  if (dist.link_policy === 'keyword_dm' && !dist.dm?.integration_verified) issues.push({ severity: 'error', msg: 'link_policy keyword_dm needs dm.integration_verified=true; otherwise use library_link' });
  if (dist.link_policy === 'keyword_dm' && !dist.dm?.opt_out_text?.trim()) issues.push({ severity: 'error', msg: 'keyword_dm needs dm.opt_out_text (a real opt-out line)' });
  if (!dist.ab_hooks.some((h) => h.id === dist.ab_hooks[0].id)) issues.push({ severity: 'error', msg: 'ab_hooks malformed' });
  for (const [pl, t] of Object.entries(texts)) {
    const hashtags = (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    if (hashtags > 10) issues.push({ severity: 'warn', msg: `${pl} has ${hashtags} hashtags` });
    if (!t.includes(input.keyword) && pl === 'instagram' && dist.link_policy === 'keyword_dm') issues.push({ severity: 'warn', msg: `instagram copy never mentions the keyword "${input.keyword}"` });
  }
  return issues;
}

export function buildPlan(dist, input, product, gate, cfg, id, approvals) {
  const base = gate.verdict === 'OPEN' ? input.hosted_url : null;
  const hook = dist.ab_hooks[0].id;
  const items = [];
  const push = (platform, fields) => {
    const link = utmUrl(base, cfg, platform, id, hook, input.keyword);
    const body = { platform, fields, link };
    const action = `post:${platform}`;
    const hash = sha256(JSON.stringify(body));
    items.push({ action, platform, fields, link, content_sha256: hash, requires_approval: true, approved: (approvals?.approvals ?? []).some((a) => a.action === action && a.content_sha256 === hash) });
  };
  const P = dist.platforms;
  push('instagram', { caption: P.instagram.caption, story_teaser: P.instagram.story_teaser, thumbnail_text: dist.thumbnail_text, alt_text: dist.alt_text });
  push('tiktok', { caption: P.tiktok.caption, alt_text: dist.alt_text });
  push('shorts', { title: P.shorts.title, description: P.shorts.description });
  push('linkedin', { caption: P.linkedin.caption, alt_text: dist.alt_text });
  const variants = dist.ab_hooks.map((h) => ({ hook_id: h.id, text: h.text, links: Object.fromEntries(['instagram', 'tiktok', 'shorts', 'linkedin'].map((pl) => [pl, utmUrl(base, cfg, pl, id, h.id, input.keyword)])) }));
  return {
    schema: 'systm/publish-plan@1', episode_id: id, dry_run: true, remote_writes: [],
    gate: gate.verdict, link_policy: dist.link_policy,
    notes: [
      gate.verdict === 'OPEN' ? 'Links carry UTMs from the tested hosted URL.' : 'No links in the plan: the release gate is BLOCKED, copy must stay honest ("coming soon").',
      'Nothing is posted by this plugin. A human posts, or approves a provider integration that is verified to work.',
      dist.link_policy === 'keyword_dm' ? 'Keyword DM is only allowed because dm.integration_verified is true.' : 'Keyword comment gets a public library link, no DM.',
    ],
    funnel: ['views', 'visits', 'activations', 'qualified_consultations'],
    items, ab_variants: variants,
  };
}

export function utmCsv(plan) {
  const rows = [];
  for (const v of plan.ab_variants) for (const [pl, link] of Object.entries(v.links)) rows.push({ hook_id: v.hook_id, platform: pl, url: link ?? '' });
  return toCsv(['hook_id', 'platform', 'url'], rows);
}

export function planMd(plan, dist) {
  const items = plan.items.map((i) => `### ${i.platform} · ${i.approved ? 'מאושר' : 'ממתין לאישור'}\n\n${Object.entries(i.fields).map(([k, v]) => `**${k}**\n\n${v}`).join('\n\n')}\n\nקישור: ${i.link ?? '(אין, השער חסום)'}\n\nhash: \`${i.content_sha256.slice(0, 12)}\``);
  return `# ${plan.episode_id} · תוכנית הפצה (dry run)\n\nשער מוצר: **${plan.gate}** · מדיניות קישור: ${plan.link_policy}\n\n${plan.notes.map((n) => `- ${n}`).join('\n')}\n\n${items.join('\n\n')}\n\n## וריאציות הוק ל-A/B\n\n${plan.ab_variants.map((v) => `- ${v.hook_id}: ${v.text}`).join('\n')}\n\nמשפך מדידה: ${plan.funnel.join(' → ')}\n`;
}
