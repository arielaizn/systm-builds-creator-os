---
name: systm-storyboard-director
description: "Turn a SYSTM BUILDS script into a shotlist and a shoot plan: A-CAM, SCREEN and MOTION shots with framing, source, cut motivation, overlay, cursor zoom and safe zones, plus the exact capture list that produces each piece of evidence. Use for /systm-shots, 'plan the shoot', or before filming and screen recording. Triggers: שוטליסט, shotlist, תכנון צילום, הקלטת מסך, storyboard, systm shots."
---

# systm-storyboard-director

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Home studio, one camera, one screen recording, minimal motion. Prefer simple and real over clever.

## From script to shotlist

1. Confirm `script.json` passes `systm verify` (plan stage).
2. For each beat decide the shots. One shot per beat is the default. Split a beat into `shots[]` (with `weight` for the time share) when the picture changes inside it: a cursor move, a before/after, a zoom. Each shot: `mode`, `asset`, `framing`, `action`, `overlay`, `audio`, `evidence`.
3. Write the **cut motivation** in `transition` for every cut: new information, a question asked, a result revealed. A cut with no reason is removed.
4. `systm build EPxxx`. Read `build/shotlist.csv` (`id, beat, in, out, mode, asset, framing, action, overlay, audio, evidence`) and `build/edl.csv` as the creator will: timecodes `HH:MM:SS:FF` at 30fps, contiguous frames, no gaps.

## Modes

| Mode | Source | Notes |
|---|---|---|
| A-CAM | presenter at eye level, good microphone, dark room with a cyan accent light | keep the creator's approved likeness and look unchanged. Direct to camera. No gestures that fight the words |
| SCREEN | real application captured in high resolution | zoom on the cursor for every action, hold for readability, blur emails, names, phone numbers and keys, mark accelerated sections |
| MOTION | minimal Hebrew kinetic text and flow diagrams | no generic robots, no stock icons. Built by `systm-motion-director` |

## Framing and safe zones

1080x1920. Keep text and critical UI inside the safe area from `config.json` (default 220 px top, 420 px bottom, 60 px sides). Phone readability beats resolution: if a screen element is not legible at 6 cm wide, zoom in or redo the capture.

## Shoot plan

Write `systm/episodes/EPxxx/shoot-plan.md` with:

- **Capture list**: one row per evidence id (`E1`...): what exactly must be on screen, which input file or state to start from, what the recording must show at the end, and the file name to save it as (`captures/E1-run.mov`). Edge case files are prepared before recording.
- **A-CAM list**: each beat shot on camera, the line, the framing, the pause.
- **Setup**: light, microphone, frame rate, screen resolution (2x), the demo data to load and its label.
- **Checks after each take**: file opens, no PII visible, cursor visible, text legible on a phone-sized preview.

When a recording is done, tell the creator to open it and confirm. Only then does the evidence move to `captured`, and after their check to `verified`.

## Done when

Every beat has a source, every evidence id has a capture instruction, and the creator knows what to do first.
