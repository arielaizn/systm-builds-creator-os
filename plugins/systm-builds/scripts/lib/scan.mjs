// Hebrew-aware text scans shared by the verifier and the distribution check.
// JS \b does not work on Hebrew, so words are matched with explicit lookarounds, and a word may
// carry the usual one-letter prefixes (ו ה ב כ ל מ ש) so "להורדה" matches "הורדה".
const HEB = '֐-׿';
const PRE = '[והבכלמש]{0,3}';
export const hw = (alts) => new RegExp(`(?<![${HEB}])${PRE}(?:${alts})(?![${HEB}])`, 'u');
export const hwStem = (alts) => new RegExp(`(?<![${HEB}])${PRE}(?:${alts})[${HEB}]{0,3}`, 'u');

const NUM = 'אחד|אחת|שניים|שתיים|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|שבע|שבעה|שמונה|תשע|תשעה|עשר|עשרה|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|אלף|אלפיים|חצי|כמה|הרבה|\\d[\\d,.]*';
const UNIT = 'שעה|שעות|שעתיים|דקה|דקות|ימים|יום עבודה|ימי עבודה|שבוע|שבועות|חודש|חודשים';
const CUR = 'שקל|שקלים|ש"ח|ש״ח|₪|דולר|דולרים|\\$|אירו';
const COUNTED = 'לקוחות|לקוח|משתמשים|עסקים|בעלי עסקים|אנשים|מנויים|עוקבים|חברות|צופים';

// Claim triggers: a sentence that matches needs a claim of that type backed by evidence.
export const TRIGGERS = [
  { type: 'built', re: hwStem('בניתי|בנינו|הקמתי|הקמנו|פיתחתי|פיתחנו|יצרתי|יצרנו|השקתי|השקנו|פרסתי|פרסנו|בנוי|בנויה') },
  { type: 'built', re: /הכלי\s+עובד\s+אצל/u },
  { type: 'time_saved', re: hwStem('חסכ|חסך|חוסכ|חוסך|קיצר|מקצר|חיסכון|נחסכ') },
  { type: 'time_saved', re: new RegExp(`(?:${NUM})\\s+(?:${UNIT}).{0,25}(?:פחות|בחזרה|במקום|נחסכ|חוסכ)|(?:פחות|בחזרה|חוסכ).{0,25}(?:${NUM})\\s+(?:${UNIT})|חצי\\s+שעה\\s+פחות|שעה\\s+שלמה\\s+בחזרה`, 'u') },
  { type: 'roi', re: /ROI|החזר\s+השקעה/u },
  { type: 'roi', re: hwStem('הרווחנו|הרווחתי|הכנסתי|הכנסות|רווחים') },
  { type: 'roi', re: /(?:עלייה|ירידה|גידול|קפיצה)\s+של/u },
  { type: 'roi', re: new RegExp(`\\d+\\s*%|(?:${NUM})\\s+אחוז|פי\\s+(?:${NUM})|(?:${NUM})\\s+(?:${CUR})|(?:${CUR})\\s*(?:${NUM})`, 'u') },
  { type: 'social_proof', re: new RegExp(`(?:אלפי|מאות|עשרות|מיליוני|רבבות|מעל\\s+\\S+|\\d[\\d,]*)\\s+(?:${COUNTED})`, 'u') },
  { type: 'social_proof', re: /לקוחות\s+מרוצים|הכי\s+טוב\s+ב|מספר\s*(?:1|אחת)(?!\d)/u },
  { type: 'customer', re: /(?:הלקוח|הלקוחה|הלקוחות|לקוח|לקוחה|לקוחות)\s+(?:שלי|שלנו)|אחד\s+הלקוחות|אחת\s+הלקוחות/u },
  { type: 'quote', re: /(?:אמר|אמרה|אמרו|כתב|כתבה|כתבו|שלח|שלחה|שלחו|הגיב|הגיבה|הגיבו)\s+(?:לי|לנו)/u },
  { type: 'quote', re: /(?<![\u0590-\u05FF"])"(?=[^"\s])[^"]*[\u0590-\u05FF][^"]*"(?![\u0590-\u05FF])/u, minWords: 3 },
];

export function claimHits(text) {
  const t = String(text ?? '');
  const hits = [];
  for (const tr of TRIGGERS) {
    const m = t.match(tr.re);
    if (!m) continue;
    if (tr.minWords && m[0].replace(/"/g, '').trim().split(/\s+/).length < tr.minWords) continue;
    hits.push({ type: tr.type, match: m[0].trim().slice(0, 40) });
  }
  const seen = new Set();
  return hits.filter((h) => (seen.has(h.type) ? false : seen.add(h.type)));
}

const GIVEAWAY = hwStem('בחינם|חינם|חינמי|הורד|תורידו|הורידו|להוריד|קוד\\s+פתוח|גיטהאב|github|קישור|לינק|בביו|בפרופיל|הקוד|בספרייה|זמין|מתנה|קחו|שולח\\s+לכם|אשלח');
const GIVEAWAY_LATIN = /\bgithub\b|\bfree\b|\bdownload\b/i;
// Only a marker that says "not yet" disarms the sentence. A bare "לא" or "אין" does not ("ללא הרשמה", "אין צורך").
const NOT_YET = hw('עדיין|בקרוב|כשזה|כשהוא|אחרי\\s+שזה|אחרי\\s+שאני|בהמשך|לפני\\s+שזה');

export function sentences(text) {
  return String(text ?? '').split(/(?<=[.!?])\s+|\n+/u).map((s) => s.trim()).filter(Boolean);
}

export function giveawayOffenders(text) {
  return sentences(text).filter((s) => (GIVEAWAY.test(s) || GIVEAWAY_LATIN.test(s)) && !NOT_YET.test(s));
}

const REQUEST_PAST = hwStem('ביקשתם|ביקשת|ביקשו|ביקשה|ביקש|פנו\\s+אליי|פנית\\s+אליי|כתבתם\\s+לי|שאלתם\\s+אותי|הגיבו\\s+לי');
export function impliesRequest(text) {
  // "אף אחד עוד לא ביקש" is the honest sentence for an observed need: drop negated forms first.
  const t = String(text ?? '').replace(/לא\s+(?:\S+\s+){0,2}ביקש\S*/gu, ' ').replace(/אין\s+(?:\S+\s+){0,2}בקשות?/gu, ' ');
  return REQUEST_PAST.test(t) || /קיבלתי\s+(?:כמה\s+|הרבה\s+)?בקשות?|מישהו\s+ביקש/u.test(t);
}

export function beatTexts(beat) {
  const out = [{ where: `beat ${beat.n} vo`, text: beat.vo ?? '', kind: 'vo' }, { where: `beat ${beat.n} overlay`, text: beat.on_screen_text ?? '', kind: 'overlay' }];
  (beat.shots ?? []).forEach((s, i) => { if (s.overlay) out.push({ where: `beat ${beat.n} shot ${i + 1} overlay`, text: s.overlay, kind: 'overlay' }); });
  return out;
}

export function distributionTexts(d) {
  const P = d.platforms;
  return [
    ['instagram caption', P.instagram.caption], ['instagram story', P.instagram.story_teaser], ['tiktok caption', P.tiktok.caption],
    ['shorts title', P.shorts.title], ['shorts description', P.shorts.description], ['linkedin caption', P.linkedin.caption],
    ['thumbnail text', d.thumbnail_text], ['alt text', d.alt_text], ...d.ab_hooks.map((h) => [`ab hook ${h.id}`, h.text]),
  ].map(([where, text]) => ({ where, text }));
}
