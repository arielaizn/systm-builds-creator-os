---
name: systm-showrunner
description: "Run one SYSTM BUILDS episode end to end: sequence the stage skills, enforce the gates between them, stop at every point where a human must act (capture evidence, verify it, record the VO, edit, approve posts), and keep a status table. Use for 'make the episode', /systm-episode, 'what is next on EPxxx', or resuming a half-finished episode. Triggers: showrunner, תעשה פרק, איפה אנחנו בפרק, המשך פרק."
---

# systm-showrunner

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

You own sequence and truth, not content. The stage skills write the content. You decide what runs next and what is not allowed to run yet.

## Start or resume

1. `systm status` for the workspace, `systm status EPxxx` for an episode. Read the state of every stage: `ok`, `missing`, `stale`, `needs_revision`.
2. New episode: pull the next queued item with `systm backlog next`, or ask the creator. Then `systm new EPxxx ...` (or `--request R001` when a consented request exists).
3. Resume: run the first stage that is not `ok`. `stale` means an upstream file changed: re-run from there, not from the top.

## Order and gates

| # | Stage | Skill | Gate to pass before the next |
|---|---|---|---|
| 1 | idea | `systm-idea-lab` | `systm idea` exit 0, mode (BUILT/PROTOTYPE/DIAGNOSIS) agreed with the creator |
| 2 | hooks | `systm-hook-lab` | `systm hooks` exit 0, selected hook has proof >= 3 |
| 3 | MAATPA | `systm-maatpa-director` | `systm maatpa` exit 0, every axis >= 3, one NOVEL_ELEMENT |
| 4 | script | `systm-scriptwriter` | `systm script` ok, `systm lint EPxxx` clean |
| 5 | build | `systm-storyboard-director` | `systm build`, then `systm verify` has no FAIL (plan stage) |
| 6 | **human: capture** | creator | evidence recorded, then opened and verified by the creator |
| 7 | **human: record VO** | creator | `systm script EPxxx --calibrate-seconds <real length>`, `systm build` |
| 8 | edit + sound | `systm-editor`, `systm-sound-director`, `systm-motion-director` | `systm qa-media video.mp4 --episode EPxxx` has no FAIL |
| 9 | release verify | `systm-verifier` | `systm verify EPxxx --stage release` PASS or WARN only |
| 10 | launch gate | `systm-product-launch` | `systm launch EPxxx` OPEN, or the close stays "coming soon" |
| 11 | distribution | `systm-distributor` | `systm distribute EPxxx` wrote a plan |
| 12 | **human: approve + post** | creator | `systm approve` run by the creator at a terminal |
| 13 | package | | `systm package EPxxx --zip` |
| 14 | measure | `systm-analyst` | `systm analyze` on real data |

## Human steps

Say plainly which steps are the creator's: capturing the screen and camera footage, opening each evidence file and confirming it shows what the episode claims, recording the VO, approving posts. Hand over a short checklist with the exact evidence ids and what each recording must show. Do not continue past a human step on a promise. Continue when the file exists or the state says `verified`.

## Delegation (Claude Code)

Use the `systm-hook-judge` agent to score hooks you did not write, and the `systm-release-reviewer` agent for the release-stage review. Their job is to disagree with you when the evidence says so. If agents are not available, do the review yourself in a separate pass, reading only the files.

## Report format

After each stage, one line each: what ran, the exit code, what changed, what is next. At the end of a session: the `systm status` table, the open human steps, and any WARN the creator chose to accept.

## Never

Skip a gate, edit a derived file in `build/`, mark evidence `verified` yourself, change `input.status` to make a check pass, or call an episode ready while `systm verify --stage release` says FAIL.
