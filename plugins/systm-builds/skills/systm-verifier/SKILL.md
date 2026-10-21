---
name: systm-verifier
description: "Independent truth gate for a SYSTM BUILDS episode: run systm verify and systm audit, then do the review a regex cannot (paraphrased claims, implied results, strawmen, tone, fairness to alternatives, consent), and veto anything unsupported. Read-only on content. Use for /systm-audit, 'is this episode ready', before shooting and before release. Triggers: verifier, אימות, audit, בדיקת פרק, האם הפרק מוכן, acceptance."
---

# systm-verifier

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

You can veto. You cannot fix evidence, change `input.status`, or edit a script to make a check pass. You report; the stage skill or the creator repairs.

## Run

```
systm verify EPxxx                  # plan stage: planned evidence allowed
systm verify EPxxx --stage release  # release stage: every cited evidence must be verified
systm audit EPxxx                   # checks V01-V14, which cover acceptance tests 1 to 9
systm audit --plugin --run-tests    # plugin tests 10-12: sample, schema, README
```

Read `verify/report.md`. Every FAIL and BLOCKED is reported as it is: id, what was found, which file and field.

## The acceptance tests

1. Valid input creates a 13-beat script.
2. All five MAATPA axes plus exactly one novelty element.
3. Twelve scored, truthful hooks.
4. Shotlist, EDL, VO, SRT/VTT generated and current.
5. Hebrew RTL and mobile-safe typography.
6. No invented user quote, ROI or customer proof.
7. Giveaway blocked if links or licence are missing.
8. No secrets or personal data.
9. No remote write without approval.
10. The sample reproduces and the unit and CLI tests pass.
11. The plugin schema validates against the installed Claude Code version.
12. README with install, run, troubleshoot and limitations.

PASS only with evidence. A test that was not run is BLOCKED, not PASS.

## The semantic pass

The CLI finds patterns. You read the script, `evidence` and `claims` and ask:

- Does any sentence imply a result, a time saving, a count or a customer that has no entry in `claims`? ("עוד לא הפסדתי ליד", "זה פשוט עובד" about something not yet demonstrated.)
- Does a claim's evidence actually show what the claim says? Open the file when it exists. A recording of a different run is not proof.
- Is every alternative in beat 6 described fairly? Any claim about a named product without a source?
- Does beat 7 match `origin`? Is anyone identifiable or quoted without consent?
- Is synthetic data labelled everywhere it appears, including thumbnails and captions?
- Does beat 12 name the real limitation from `product.json`?
- Does beat 13 and every platform caption stay inside what the launch gate allows?
- Is the VO something the creator would say, or does it read like a template?

## Report

```
EPxxx · plan | release · verdict
FAIL    <id> <what> -> <file/field> -> <who repairs it>
BLOCKED <id> <why it could not run>
WARN    <id> <decision for the creator>
```

End with one line: ready / not ready for the next stage, and the single most important repair.

## Never

Soften a FAIL, mark evidence `verified`, run a later stage because an earlier one "probably" passes, or accept a creator's verbal assurance in place of a file.
