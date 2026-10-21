import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER = /(\bTODO\b|\bTBD\b|\bFIXME\b|\?\?\?|לא ידוע|\{\{|\[[A-Z_ ]{2,}\]|<[A-Za-z _-]{2,}>)/;
const filled = (s) => typeof s === 'string' && s.trim().length > 0 && !PLACEHOLDER.test(s);
const SPDX = /^(MIT|ISC|0BSD|Unlicense|CC0-1\.0|MPL-2\.0|EUPL-1\.2|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|(A|L)?GPL-[123]\.0(-only|-or-later)?)$/;
const FAKE_HOST = /(^|\.)(example\.(com|org|net)|localhost|invalid|test)$|^127\.|^0\.0\.0\.0$|\.local$/i;
const PLACEHOLDER_PATH = /(OWNER|REPO|YOUR[-_ ]?\w*|USERNAME|APP_NAME)/;

export function httpsUrl(u) {
  if (typeof u !== 'string' || PLACEHOLDER.test(u) || PLACEHOLDER_PATH.test(u)) return false;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && x.hostname.includes('.') && !FAKE_HOST.test(x.hostname) && !/\s/.test(u);
  } catch { return false; }
}

const testedRecord = (t) => Boolean(t) && /^\d{4}-\d{2}-\d{2}/.test(t.tested_on ?? '') && typeof t.tested_by === 'string' && t.tested_by.trim().length >= 2 && !/^(x|y|n\/?a|none|agent|ai|claude|codex)\b/i.test(t.tested_by.trim());

export function productGate(product, input, baseDir) {
  const checks = [];
  const add = (id, ok, msg) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', msg });
  add('status_built', product.status === 'BUILT', `product status is ${product.status}, only BUILT can be given away`);
  add('input_status_built', input.status === 'BUILT', `episode status is ${input.status}`);
  add('version', filled(product.version), 'version is empty');
  add('hosted_url', httpsUrl(product.hosted_url), 'hosted_url is missing or not https');
  add('hosted_url_tested', testedRecord(product.hosted_url_tested), 'hosted URL needs tested_on (YYYY-MM-DD) and tested_by (a person)');
  add('repo_url', httpsUrl(product.repo_url), 'repo_url is missing or not https');
  add('repo_url_tested', testedRecord(product.repo_url_tested), 'repo URL needs tested_on (YYYY-MM-DD) and tested_by (a person)');
  add('urls_match_input', product.hosted_url === input.hosted_url && product.repo_url === input.repo_url, 'product URLs differ from episode input URLs');
  add('license', SPDX.test(product.license ?? ''), 'license must be a recognised SPDX id (MIT, Apache-2.0, GPL-3.0-only, AGPL-3.0-only, ...): published source without a license is not open source');
  add('install', filled(product.install), 'install instructions are missing');
  add('quotas', filled(product.quotas), 'hosted free-tier quotas are not disclosed');
  add('costs', filled(product.costs?.hosting) && filled(product.costs?.api) && filled(product.costs?.third_party), 'hosting/API/third-party costs are not all disclosed');
  add('privacy', filled(product.privacy), 'privacy statement is missing');
  add('known_issues', Array.isArray(product.known_issues) && product.known_issues.length > 0 && product.known_issues.every(filled), 'known issues are missing');
  add('support', filled(product.support), 'support channel is missing');
  add('capabilities', Array.isArray(product.capabilities) && product.capabilities.length > 0, 'capabilities list is empty');
  const shots = product.screenshots ?? [];
  const okShot = (f) => { try { const abs = path.resolve(baseDir, f); const st = fs.statSync(abs); return st.isFile() && st.size > 0 && /\.(png|jpe?g|webp|gif)$/i.test(abs) && !path.relative(baseDir, abs).startsWith('..'); } catch { return false; } };
  add('screenshots', shots.length > 0 && shots.every(okShot), 'screenshots must be non-empty image files inside the episode folder');
  if (product.free_forever_claim) add('free_forever', filled(product.sustainability_note), '"free forever" is claimed without a sustainability note');
  const failed = checks.filter((c) => c.status === 'FAIL');
  return { verdict: failed.length ? 'BLOCKED' : 'OPEN', checks, missing: failed.map((c) => c.msg) };
}

// Read-only: HEAD, and when a server refuses HEAD, a one-byte ranged GET. Never anything that writes.
export async function checkUrls(urls, timeoutMs = 8000) {
  const out = [];
  const hit = async (url, method) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try { return await fetch(url, { method, redirect: 'follow', signal: ctl.signal, headers: method === 'GET' ? { Range: 'bytes=0-0' } : {} }); } finally { clearTimeout(t); }
  };
  for (const url of urls.filter(Boolean)) {
    try {
      let res = await hit(url, 'HEAD');
      if ([403, 405, 501].includes(res.status)) res = await hit(url, 'GET');
      out.push({ url, ok: res.status >= 200 && res.status < 400, status: res.status });
    } catch (e) {
      out.push({ url, ok: false, status: null, error: e.name === 'AbortError' ? 'timeout' : e.message });
    }
  }
  return out;
}
