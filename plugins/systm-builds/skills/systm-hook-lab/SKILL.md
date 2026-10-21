---
name: systm-hook-lab
description: "Generate and score 12 truthful hooks for the first 0-3 seconds of a SYSTM BUILDS episode, rank them with the deterministic weights (audience fit, curiosity, specificity, proof, visual strength), and select one that can be shown on screen. Use for /systm-hooks, 'give me hooks', or a hook that is not holding attention. Triggers: הוקים, hook lab, 3 שניות ראשונות, systm hooks."
---

# systm-hook-lab

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

A hook is a promise the first three seconds keep. If it cannot be shown on screen, it does not get selected, however good it sounds.

## Write 12 (`systm scaffold hooks EPxxx`, then fill `hooks.json`)

Types: `result_first`, `pain_first`, `constraint_first`, `contradiction`, `surprising_test`, `owner_pain`. Use at least four types. Rules per hook:

- Hebrew, spoken, at most **9 words** (3 seconds).
- No greeting ("שלום", "היי", "ברוכים הבאים") and no branding bumper ("SYSTM BUILDS" as an opener).
- Concrete: a thing on screen, a number the evidence will show, a named situation.
- `provable_with`: the evidence ids that will show it. A hook with no evidence is a pain hook at best, and its `proof` score is 0 to 2.
- No invented first-person experience ("לא עניתי לליד שלוש שבועות") unless the creator said it happened.

## Score

Integers 0 to 5 per dimension. Anchors:

| Dimension | 0-1 | 3 | 5 |
|---|---|---|---|
| audience_fit | any viewer | a role, not a pain | the named owner recognises themselves in a second |
| curiosity | answers itself | an open question | the viewer needs the next sentence |
| specificity | "הרבה", "מהר" | a category | a concrete object, quantity or situation |
| proof | cannot be shown | a recording is planned | the evidence exists and shows it |
| visual_strength | talking head only | the screen shows it eventually | the first frame is the proof |

Score the 12 **without looking at the weights**, and have the scores reviewed by someone who did not write the hooks: in Claude Code use the `systm-hook-judge` agent, elsewhere do a second pass reading only the hook text and the evidence descriptions. Where the two sets differ by 2 or more, discuss and settle on one.

## Rank and select

`systm hooks EPxxx` computes `total` and `rank` (weights: audience_fit 1.2, curiosity 1.2, specificity 1, proof 1.5, visual_strength 0.8) and writes `hooks.md`. Then:

- `selected` is usually rank 1. If you pick lower, write the reason in the hook's `note`. The tool warns when the gap is 0.5 or more.
- The selected hook needs `proof >= 3` and a non-empty `provable_with`, or the command fails.
- Choose two more for A/B. They go to `systm-distributor`.

## Done when

`systm hooks EPxxx` exits 0 and the selected hook text is exactly what beat 1 will say.
