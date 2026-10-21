import { words } from './util.mjs';

export const RLM = '‏';
const HEB = '֐-׿';
const L = `(?<![${HEB}])`;
const R = `(?![${HEB}])`;
const tok = (s) => new RegExp(`${L}${s}${R}`, 'u');

export const hasHebrew = (s) => /[֐-׿]/.test(s ?? '');

// Mirrors the "no AI voice" rules: patterns that give a model away in Hebrew copy.
const RULES = [
  { code: 'EM_DASH_SPACED', sev: 'error', re: /\s[—–]\s/u, msg: 'spaced long dash' },
  { code: 'CURLY_QUOTES', sev: 'error', re: /[“”‘’]/u, msg: 'curly quotes, use straight quotes' },
  { code: 'NEG_PARALLEL', sev: 'error', re: /לא\s+רק\s+[^.!?\n]{1,80}?\s+אלא(\s+גם)?/u, msg: 'negative parallelism (לא רק X אלא Y)' },
  { code: 'NEG_PARALLEL', sev: 'error', re: /(זה|זו|זאת|הוא|היא)\s+לא\s+[^.!?\n,]{1,40},\s*(זה|זו|זאת|הוא|היא)\s/u, msg: 'negative parallelism (זה לא X, זה Y)' },
  { code: 'NEG_PARALLEL', sev: 'error', re: /השאלה\s+(היא\s+)?לא\s+[^.!?\n]{1,60}\s+אלא/u, msg: 'negative parallelism (השאלה היא לא X אלא Y)' },
  { code: 'NEG_PARALLEL', sev: 'error', re: /אין\s+כאן\s+[^.!?\n]{1,40}[.!]\s*יש\s+כאן/u, msg: 'negative parallelism (אין כאן X. יש כאן Y)' },
  { code: 'NEG_PARALLEL', sev: 'error', re: /פחות\s+[^,.\n]{1,25},\s*יותר\s/u, msg: 'negative parallelism (פחות X, יותר Y)' },
  { code: 'SUMMARY_CLOSER', sev: 'error', re: /(^|[.!?]\s+|\n)(לסיכום|לסיום|בשורה התחתונה|בסופו של דבר|בסופו של יום)/u, msg: 'closing summary phrase' },
  { code: 'TEMPLATE_OPENER', sev: 'error', re: /(^|\n)\s*(תארו לעצמכם|זה נשמע מוכר|תנו לזה לשקוע|והנה הקטע|עצור את הגלילה|בוא נצלול|בואו נצלול)/u, msg: 'template opener' },
  { code: 'AUDIENCE_COVER', sev: 'error', re: /בין\s+אם\s+אתה[^.!?\n]{1,60}ובין\s+אם/u, msg: 'artificial audience cover (בין אם... ובין אם)' },
  { code: 'BANNED_PHRASE', sev: 'error', re: new RegExp(`${L}(לצלול|נצלול|מהווה|מהווים|מהווות|הינו|הינה|פורץ דרך|פורצת דרך|משנה משחק|ברמה אחרת|חוויה בלתי נשכחת|מגוון רחב|פתרון מושלם|שדרוג משמעותי|יוצא דופן|לא בכדי|בעידן הדיגיטלי|בעולם של היום|בעולם המהיר|כאן נכנס לתמונה|פותח בפניכם|אנו מזמינים|לקחת את זה לשלב הבא|המפתח הוא)${R}`, 'u'), msg: 'AI-sounding phrase' },
  { code: 'BANNED_WORD_WEAK', sev: 'warn', re: tok('(מסע|מרהיב|מרתק|עוצמתי|קריטי|מכריע|אנו|אשר)'), msg: 'AI-leaning word (check it is really needed)' },
  { code: 'FUNCTION_AS', sev: 'warn', re: tok('(משמש|משמשת|מתפקד|מתפקדת)\\s+כ'), msg: 'avoid "serves as", use "הוא"' },
  { code: 'ANALYSIS_TAIL', sev: 'warn', re: /,\s*(מה\s+ש(מדגיש|מאפשר|מחזק|מבסס)|ובכך|תוך\s+ש(הוא|היא|זה))/u, msg: 'shallow trailing analysis clause' },
  { code: 'TRANSITION_OPENER', sev: 'warn', re: /(^|[.!?]\s+|\n)(בנוסף|כמו כן|יתרה מכך|זאת ועוד|ראוי לציין|חשוב לציין|יש לציין)[,\s]/u, msg: 'stacked transition opener (allow one per text)' },
  { code: 'DRAMATIC_ELLIPSIS', sev: 'warn', re: /\.{3}|…/u, msg: 'dramatic ellipsis' },
  { code: 'EMOJI', sev: 'warn', re: /\p{Extended_Pictographic}/u, msg: 'emoji' },
  { code: 'ENGLISH_AI_WORD', sev: 'warn', re: /\b(delve|tapestry|seamless|leverage|game-?changer|cutting-edge|revolutioni[sz]\w*|unlock)\b/i, msg: 'English AI-vocabulary word' },
];

const GREETING = /^\s*(שלום|היי|הי|אהלן|ברוכים הבאים|ברוך הבא)(\s|,|!|$)/u;
const BUMPER = /^\s*(SYSTM\s*BUILDS|סיסטם\s*בילדס)/iu;

export function lintText(text, { hook = false } = {}) {
  const findings = [];
  const t = String(text ?? '');
  const seen = new Set();
  for (const r of RULES) {
    const m = t.match(r.re);
    if (!m) continue;
    const key = `${r.code}:${m[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ code: r.code, severity: r.sev, message: r.msg, match: m[0].trim().slice(0, 60) });
  }
  if (hook) {
    if (GREETING.test(t)) findings.push({ code: 'HOOK_GREETING', severity: 'error', message: 'hook opens with a greeting', match: t.slice(0, 20) });
    if (BUMPER.test(t)) findings.push({ code: 'HOOK_BUMPER', severity: 'error', message: 'hook opens with a branding bumper', match: t.slice(0, 20) });
  }
  // count of stacked transition openers
  const trans = (t.match(/(^|[.!?]\s+|\n)(בנוסף|כמו כן|יתרה מכך|זאת ועוד|ראוי לציין|חשוב לציין|יש לציין)[,\s]/gu) ?? []).length;
  if (trans > 1) findings.push({ code: 'TRANSITION_STACK', severity: 'error', message: `${trans} transition openers in one text`, match: '' });
  // uniform sentence length (needs >= 4 sentences to mean anything)
  const sentences = t.split(/[.!?]+\s+|\n+/u).map((s) => words(s).length).filter(Boolean);
  if (sentences.length >= 4) {
    const spread = Math.max(...sentences) - Math.min(...sentences);
    if (spread <= 2) findings.push({ code: 'UNIFORM_SENTENCES', severity: 'warn', message: 'all sentences are nearly the same length', match: '' });
  }
  return findings;
}

export function withRlm(line) {
  return hasHebrew(line) && !line.startsWith(RLM) ? RLM + line : line;
}
