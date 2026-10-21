---
name: systm-setup
description: "Set up SYSTM BUILDS Creator OS on this machine and in this project: audit Node, the agent CLI, ffmpeg, Hebrew fonts, Remotion, disk and permissions, then create the systm/ workspace with config, show bible, requests ledger and backlog. Use for first run, a broken environment, or /systm-init. Triggers: התקנה, init, doctor, בדיקת סביבה, systm init, M0."
---

# systm-setup · milestone M0

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

## Steps

1. Run `systm doctor`. Report every WARN and FAIL in one short list with the fix next to it. INFO lines (an agent CLI that is not installed, Remotion) are not problems.
2. Check what matters for this episode, not everything:
   - `ffmpeg`/`ffprobe` missing: `systm qa-media` and frame export will not run. Install with the package manager the user already uses.
   - `ffmpeg_subtitles` WARN: this ffmpeg cannot burn captions. Captions are delivered as SRT/VTT for the editor. Do not promise burned-in Hebrew with this build.
   - `hebrew_fonts` WARN: ask the user to install Heebo, Assistant or Rubik before any MOTION work.
   - `disk` WARN: renders and screen recordings are large. Say how much room is left and stop if it is under a few GB.
3. Run `systm init`. It creates `systm/config.json`, `SHOW_BIBLE.md`, `series/requests.jsonl`, `series/backlog.json` and a `.gitignore` that keeps renders and `.env` out of git.
4. Open `systm/config.json` with the user and confirm: format (1080x1920, 30fps), duration targets (60 to 75s), brand colours, safe zone, voice speed (`voice.wps`, replaced by the measured rate after the first recording).
5. Tell the user, in two lines, what the plugin touches: it reads and writes only inside `systm/` and the files the user points it at, and the only network call it can make is a read-only `HEAD` request in `systm launch --check-urls`, when asked.
6. If the project is a git repo, check that `systm/out/`, videos and `.env` are ignored. Never add a secret to a tracked file.

## Install notes for the three agents

- Claude Code: `/plugin marketplace add arielaizn/systm-builds-creator-os` then `/plugin install systm-builds@systm-builds-marketplace`.
- Codex: `codex plugin marketplace add arielaizn/systm-builds-creator-os`, then install `systm-builds` from the plugin directory.
- OpenClaw: `openclaw plugins install <path to plugins/systm-builds>` or install from the marketplace source; the Claude and Codex manifests are both recognised as a bundle.
- Any agent that reads skills folders: `./install.sh` in the repository copies the skills and puts a `systm` launcher on PATH.

## Done when

`systm doctor` has no FAIL, `systm/` exists, and the user knows which WARNs they chose to live with.
