import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER = /(TODO|TBD|\?\?\?|לא ידוע|\[[^\]]*\])/i;
const filled = (s) => typeof s === 'string' && s.trim().length > 0 && !PLACEHOLDER.test(s);
const httpsUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s/]+\.[^\s/]+/.test(u);

// Release gate for the free-product giveaway. Every rule names what is missing, so the CTA
// can fall back to an honest "coming soon" instead of a claim that is not true yet.
export function productGate(product, input, baseDir) {
  const checks = [];
  const add = (id, ok, msg) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', msg });
  add('status_built', product.status === 'BUILT', `product status is ${product.status}, only BUILT can be given away`);
  add('input_status_built', input.status === 'BUILT', `episode status is ${input.status}`);
  add('version', filled(product.version), 'version is empty');
  add('hosted_url', httpsUrl(product.hosted_url), 'hosted_url is missing or not https');
  add('hosted_url_tested', filled(product.hosted_url_tested?.tested_on) && filled(product.hosted_url_tested?.tested_by), 'hosted URL has no tested_on/tested_by record');
  add('repo_url', httpsUrl(product.repo_url), 'repo_url is missing or not https');
  add('repo_url_tested', filled(product.repo_url_tested?.tested_on) && filled(product.repo_url_tested?.tested_by), 'repo URL has no tested_on/tested_by record');
  add('urls_match_input', product.hosted_url === input.hosted_url && product.repo_url === input.repo_url, 'product URLs differ from episode input URLs');
  add('license', filled(product.license) && !/^(none|unlicensed|unknown)$/i.test(product.license ?? ''), 'license is missing: published source without a license is not open source');
  add('install', filled(product.install), 'install instructions are missing');
  add('quotas', filled(product.quotas), 'hosted free-tier quotas are not disclosed');
  add('costs', filled(product.costs?.hosting) && filled(product.costs?.api) && filled(product.costs?.third_party), 'hosting/API/third-party costs are not all disclosed');
  add('privacy', filled(product.privacy), 'privacy statement is missing');
  add('known_issues', Array.isArray(product.known_issues) && product.known_issues.length > 0 && product.known_issues.every(filled), 'known issues are missing');
  add('support', filled(product.support), 'support channel is missing');
  add('capabilities', Array.isArray(product.capabilities) && product.capabilities.length > 0, 'capabilities list is empty');
  const shots = product.screenshots ?? [];
  add('screenshots', shots.length > 0 && shots.every((s) => fs.existsSync(path.resolve(baseDir, s))), 'screenshots are missing or the files do not exist');
  if (product.free_forever_claim) add('free_forever', filled(product.sustainability_note), '"free forever" is claimed without a sustainability note');
  const failed = checks.filter((c) => c.status === 'FAIL');
  return { verdict: failed.length ? 'BLOCKED' : 'OPEN', checks, missing: failed.map((c) => c.msg) };
}

export async function checkUrls(urls, timeoutMs = 8000) {
  const out = [];
  for (const url of urls.filter(Boolean)) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl.signal });
      clearTimeout(t);
      out.push({ url, ok: res.status >= 200 && res.status < 400, status: res.status });
    } catch (e) {
      out.push({ url, ok: false, status: null, error: e.name === 'AbortError' ? 'timeout' : e.message });
    }
  }
  return out;
}
