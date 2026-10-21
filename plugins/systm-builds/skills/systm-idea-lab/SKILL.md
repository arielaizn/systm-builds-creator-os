---
name: systm-idea-lab
description: "Shape one SYSTM BUILDS episode idea into input.json and idea.json: one product, one test, the mechanic, honest mode (BUILT, PROTOTYPE or DIAGNOSIS), origin (consented request or observed need), consent state, rejected alternatives and NOVEL_ELEMENT candidates. Use when starting an episode from a request, a pain or a tool idea. Triggers: רעיון לפרק, איזה כלי, systm idea, /systm-idea, input.json, EPISODE_INPUT."
---

# systm-idea-lab

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Interview first, then write. The answers have to come from the creator and from files, not from you.

## Ask (one short round)

- What is the tool, in one sentence, and who is the audience (a business role, not "everyone")?
- What pain does it remove, and how does the audience feel it today?
- Where did the idea come from: a request someone consented to share (`R001` in the ledger), or something the creator observed? If observed: where, how many times.
- What exists right now: nothing / a local demo / a tested hosted version with a repo? That decides the mode.
- Which edge case would a business owner recognise as the real test?
- What is the cost to run it and who pays: hosting, API keys, third parties?
- Is a real licence chosen for the code?

## Decide the mode honestly

| Mode | Means | Consequence |
|---|---|---|
| BUILT | verified, tested, available | needs `test_output` or a recording that a human verified; giveaway possible if the launch gate opens |
| PROTOTYPE | local demo, not hosted | no giveaway, no "available now", labelled demo data |
| DIAGNOSIS | concept only | no result shown, no "it works", no giveaway |

If the creator says BUILT and cannot point at the tested thing, write PROTOTYPE and say why.

## Write

1. `systm new EPxxx --product "..." --audience "..." --pain "..." --keyword "..." --novel "<the new element, plain words>" [--mode PROTOTYPE] [--request R001]`. Or `--from file.json` with the original `EPISODE_INPUT.json` shape (`"observed need"` with a space is accepted).
2. Fill `input.json › evidence` with the proof the episode will need, each as `planned`: the recording of the main run, the stress test, the test output, the document behind an observed need. Mark demo data `synthetic: true`. Do not set `verified`.
3. `systm scaffold idea EPxxx`, then fill `idea.json`:
   - `one_product`, `one_test`, `business_pain`, `mechanic` (`timer`, `audience_request`, `blind_test`, `failed_attempt`, `manual_vs_ai`, `duplicate_lead`).
   - `consent`: `required` true for a consented request, with `state` `obtained` or `pending`.
   - `novel_candidates`: two or three from `references/maatpa.md`, each with a reason. Check `systm novelty` first.
   - `rejected_ideas`: what was left out and why (too big, needs an integration that does not exist, no single test).
   - `risks`.
4. `systm idea EPxxx` until it exits 0.

## Rules

One product and one test. A second feature goes to the backlog. Do not write a hosted URL or a repo URL that was not opened. Do not create a request in the ledger to justify an episode. If the idea cannot be tested on screen in under ten seconds, narrow it.

Reference: `references/evidence-rules.md`.
