---
name: systm-scriptwriter
description: "Write the SYSTM BUILDS 13-beat script in natural Hebrew: timed beats with VO, on-screen text, visual asset, sound cue, viewer question, evidence and transition, a continuous VO, an evidence ledger, claims, sound events and an honest closing. Use for /systm-script, 'write the episode', or fixing a script that sounds like AI. Triggers: תסריט, 13 ביטים, VO, script, כתיבת פרק, קריינות."
---

# systm-scriptwriter

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Read in this order: `input.json`, `idea.json`, `maatpa.json`, the selected hook in `hooks.json`, then `references/13-beats.md` (purpose, psychology, variants, framing, proof and acceptance for every beat) and `references/hebrew-voice.md`.

## Write `script.json`

`systm scaffold script EPxxx`, then fill all 13 beats. Per beat:

| Field | Rule |
|---|---|
| `vo` | spoken Hebrew, short sentences, mixed lengths. Beat 1 starts with the selected hook, word for word |
| `on_screen_text` | at most 7 words. Hebrew. Includes the synthetic label (`script.synthetic_label`, e.g. `נתוני דמו`) on every beat that cites synthetic evidence |
| `mode` | `A-CAM`, `SCREEN` or `MOTION` |
| `asset`, `framing`, `action` | what is on screen and what moves |
| `sound_cue` | one line. Structured events go in `sound[]` |
| `viewer_question` | what the viewer wants answered at the end of the beat |
| `evidence` | ids from `input.json › evidence`. Beats 1, 10, 11 always have one |
| `transition` | hard cut, text transition, cut to screen |
| `pause_after_s` | silence after the line. Use it at the twist |
| `alternates` | up to three other VO versions for the creator to choose from |
| `combined_with` | only to merge two adjacent beats; leave `vo` empty on the merged beat |

Also fill:

- `claims`: every statement that a viewer could ask "how do you know?" about, with `type`, `beat` and `evidence`. Types and rules: `references/evidence-rules.md`.
- `sound`: `MUSIC`, `REVEAL_HIT` (exactly one), `SILENCE` (after the line, never on it), `UI`, `SONIC_LOGO` (exactly one). Record a `license` for any named `asset`.
- `cta`: `type` is `giveaway` only if `systm launch` says OPEN. Otherwise `coming_soon` or `next_request_only`. `next_request` is separate from the giveaway.
- `synthetic_label`.

## The closing line

"אתם מבקשים. אני בונה. כולם מקבלים." is the signature. When the gate is blocked, finish it honestly: "...כולם מקבלים, כשזה מוכן." Never imply a link or a download that does not exist.

## Wording rules that fail the build

- No "בניתי", "חסכנו שעות", percentages, money, "מאות לקוחות", "הלקוח שלי אמר" without a matching claim backed by non-synthetic, non-planned evidence.
- Observed need: beat 7 must not say "ביקשתם" or imply a request.
- Beat 13 may not promise a link, download or free access while the gate is blocked, unless the sentence says it does not exist yet.
- Lint patterns: negative parallelism (לא רק X אלא Y, זה לא X, זה Y), spaced long dashes, closing summaries, template openers, AI-sounding words. See `references/hebrew-voice.md`.

## Loop

1. `systm script EPxxx` (estimates the duration at `voice.wps` words per second). Target 60 to 75s.
2. `systm lint EPxxx` and fix every ERROR. Read each WARN and decide.
3. Read the whole VO aloud. A line the creator would not say gets rewritten.
4. `systm build EPxxx` and `systm verify EPxxx`. Fix FAILs here, not later.
5. After the creator records the real VO: `systm script EPxxx --calibrate-seconds <length of the recording>`, then `systm build EPxxx`. From then on the timing is measured, not estimated.

## Done when

`systm verify EPxxx` has no FAIL, the only WARN left is the duration estimate (until the VO exists), and every beat's acceptance line in `references/13-beats.md` is true.
