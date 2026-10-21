---
name: systm-maatpa-director
description: "Direct the MAATPA methodology for a SYSTM BUILDS episode: mechanism, edit and camera, text, soundtrack and hook, each with choice, why, timestamp, asset, implementation, risk, metric, repair and a 0-5 score, plus exactly one NOVEL_ELEMENT and the unanswered viewer question at 3, 15, 35 and 55 seconds. Use for /systm-maatpa, 'design the episode', or an episode that feels like the last one. Triggers: מעטפ״ה, מעטפה, מנגנון עריכה טקסט פסקול הוק, novel element, הרעיון החלק היחיד שמשתנה."
---

# systm-maatpa-director

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Read `references/maatpa.md` before writing. The principle: keep the series identity and change **one** creative element per episode.

## Steps

1. Read `input.json`, `idea.json`, `hooks.json` (selected hook) and `systm novelty`.
2. `systm scaffold maatpa EPxxx`, then fill `maatpa.json`.
3. For each axis (`mechanism`, `edit_camera`, `text`, `sound`, `hook`) write every field: `choice`, `why`, `timestamp`, `asset`, `implementation`, `risk`, `metric`, `repair`, `score`. Specific to this episode, not reusable in another.
4. Choose the single `mechanic` (`timer`, `audience_request`, `blind_test`, `failed_attempt`, `manual_vs_ai`, `duplicate_lead`). It must agree with `idea.json`.
5. Choose the one `novel_element`: `{axis, key, description}`. `key` comes from the catalogue or starts with `custom:`. It must be new inside the last three episodes.
6. Write the four `viewer_questions` at 3, 15, 35 and 55 seconds: what the viewer wonders at that moment and the script has not answered yet. No fake tension: if nothing is open at 35s, change the mechanic, not the wording.
7. Score yourself honestly. Anything under 3 means the work is not done: write the `repair` and fix the axis.
8. `systm maatpa EPxxx`. It validates, checks novelty against earlier episodes, writes `maatpa.md` and sets `status`.

## Axis notes

- **Mechanism:** the protagonist is a business role. Two real costs (they become beat 3). The reveal is earned by a test, not announced.
- **Edit and camera:** A-CAM, SCREEN, MOTION. Say which beats are which and why each cut happens. Plan zoom on the cursor for every screen action.
- **Text:** three separate layers: VO, on-screen text (<= 7 words), platform caption.
- **Sound:** voice first, licensed assets only, silence at the twist, exactly one reveal hit, one sonic logo. The cues become `script.sound`.
- **Hook:** the selected hook, and what the first frame shows.

## Done when

`systm maatpa EPxxx` exits 0, no axis is under 3, and the NOVEL_ELEMENT is one thing the creator can name in a sentence.
