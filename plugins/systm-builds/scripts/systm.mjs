#!/usr/bin/env node
import { CliError, VERSION } from './lib/util.mjs';
import { workspace } from './lib/episode.mjs';
import * as C from './lib/commands.mjs';

const HELP = `systm ${VERSION}: SYSTM BUILDS Creator OS engine

setup       doctor | init [--force] | where | status [EPxxx]
intake      request add --text "" --channel x [--source-ref url] [--consent obtained|pending|none] | request list
            backlog add --title "" [--request R001] | backlog next | backlog list | backlog set B001 --status x | novelty
episode     new EPxxx --product "" --audience "" --pain "" --keyword "" --novel "" [--mode BUILT|PROTOTYPE|DIAGNOSIS] [--request R001] [--from file.json]
            scaffold <idea|hooks|maatpa|script|distribution|product> EPxxx
stages      idea EPxxx | hooks EPxxx | maatpa EPxxx | script EPxxx [--calibrate-seconds N] | build EPxxx
gates       verify EPxxx [--stage plan|release] | launch EPxxx [--check-urls] | audit [EPxxx] [--plugin] [--run-tests] | lint <EPxxx|file>
output      package EPxxx [--zip] | distribute EPxxx | approve EPxxx --action post:instagram --by "name" (human, interactive)
measure     analyze <EPxxx|all> --csv file.csv [--synthetic] | qa-media video.mp4 [--episode EPxxx] [--frames dir]
dev         selftest

global      --root <dir> (workspace parent, default cwd or $SYSTM_ROOT) | --json
exit codes  0 ok/warn · 1 FAIL · 2 BLOCKED · 3 refused (needs a human)
`;

const BOOLEAN = new Set(['json', 'force', 'zip', 'synthetic', 'plugin', 'run-tests', 'check-urls', 'help']);

function parse(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN.has(k)) opts[k] = true;
      else if (next === undefined || next.startsWith('--')) throw new CliError(`--${k} needs a value`);
      else { opts[k] = next; i++; }
    } else opts._.push(a);
  }
  return opts;
}

async function main() {
  const opts = parse(process.argv.slice(2));
  const [cmd, a1, a2] = opts._;
  if (!cmd || cmd === 'help' || opts.help) { console.log(HELP); return 0; }
  const ws = workspace(opts.root);
  let r;
  switch (cmd) {
    case 'where': r = C.cmdWhere(ws); break;
    case 'doctor': r = C.cmdDoctor(ws); break;
    case 'init': r = C.cmdInit(ws, { force: Boolean(opts.force) }); break;
    case 'status': r = C.cmdStatus(ws, a1); break;
    case 'request': r = C.cmdRequest(ws, a1, opts); break;
    case 'backlog': r = C.cmdBacklog(ws, a1, { ...opts, _: opts._.slice(2) }); break;
    case 'novelty': r = C.cmdNovelty(ws); break;
    case 'new': r = C.cmdNew(ws, a1, opts); break;
    case 'scaffold': r = C.cmdScaffold(ws, a1, a2); break;
    case 'idea': r = C.cmdIdea(ws, a1); break;
    case 'hooks': r = C.cmdHooks(ws, a1); break;
    case 'maatpa': r = C.cmdMaatpa(ws, a1); break;
    case 'script': r = C.cmdScript(ws, a1, opts); break;
    case 'build': r = C.cmdBuild(ws, a1); break;
    case 'verify': r = C.cmdVerify(ws, a1, opts); break;
    case 'launch': r = await C.cmdLaunch(ws, a1, opts); break;
    case 'audit': r = C.cmdAudit(ws, a1 && /^EP/.test(a1) ? a1 : null, opts); break;
    case 'lint': r = C.cmdLint(ws, a1); break;
    case 'package': r = C.cmdPackage(ws, a1, opts); break;
    case 'distribute': r = C.cmdDistribute(ws, a1); break;
    case 'approve': r = await C.cmdApprove(ws, a1, opts); break;
    case 'analyze': r = C.cmdAnalyze(ws, a1, opts); break;
    case 'qa-media': r = C.cmdQaMedia(ws, a1, opts); break;
    case 'selftest': r = C.cmdSelftest(); break;
    default: console.error(`unknown command "${cmd}"\n`); console.log(HELP); return 1;
  }
  if (opts.json) console.log(JSON.stringify({ exit: r.exit, lines: r.lines, data: r.data ?? null }, null, 2));
  else console.log(r.lines.join('\n'));
  return r.exit;
}

main().then((code) => { process.exitCode = code; }).catch((e) => {
  if (e instanceof CliError) { console.error(`error: ${e.message}`); process.exitCode = e.exitCode; }
  else { console.error(e.stack ?? e); process.exitCode = 1; }
});
