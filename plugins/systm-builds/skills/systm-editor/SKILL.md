---
name: systm-editor
description: "Assemble and check a SYSTM BUILDS edit: EDL with frame ranges, VO text, Hebrew RTL SRT and VTT, calibration from the real voice recording, import notes for common editors, and media QA with ffmpeg (resolution, fps, duration, black frames, loudness, peaks, dead air) plus per-beat frames to inspect. Use for /systm-edit, 'edit the episode', 'check the render'. Triggers: עריכה, EDL, כתוביות, SRT, VTT, qa-media, רינדור, calibrate."
---

# systm-editor

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

## After the VO is recorded

1. Measure the real length of the VO take (without the lead-in), then `systm script EPxxx --calibrate-seconds <seconds>` and `systm build EPxxx`. The timing moves from an estimate to the measured speaking rate. Check that the total is still 60 to 75 seconds. If not, cut words, not speed.
2. Open `build/captions.he.srt`. Cues are 1 to 2 lines, up to 28 characters per line, at least 0.8 seconds, each Hebrew line starting with a right-to-left mark. Timing is proportional to the words, so after the real VO exists nudge cue boundaries in the editor against the waveform. If you change the words, change `script.json` and rebuild; never edit `build/`.

## Hand-off to the editor

- `build/edl.csv`: `start_frame, end_frame, asset, transform, caption, sfx, transition`. Frames at 30fps, end exclusive, contiguous. Import as a markers/shot guide or build the timeline from it.
- `build/shotlist.csv`: the human view of the same cuts, in timecode.
- `build/vo.txt`: the continuous VO for the recording session.
- `build/sound-cues.csv`: cue sheet for `systm-sound-director`.
- `build/motion-props.json`: for the graphics.

Tell the creator how to import SRT/VTT in their editor. Burned-in Hebrew with ffmpeg needs libass and libfribidi (`systm doctor` reports it). If missing, burn captions in the editor.

## Check the render

```
systm qa-media systm/out/EP001.mp4 --episode EP001 --frames systm/out/frames
```

It checks: 1080x1920, 30fps, duration inside 60 to 75s (45 to 90s is a WARN range), audio present, black frames, sample peak, integrated loudness (target -14 LUFS, plus or minus 2) and true peak, silences over 1.5 seconds (only the twist should be silent), and writes one frame per beat.

**Open the frames.** View each `beat-NN.png` yourself and answer: is the text legible at phone size, is the Hebrew correct and in the right order, is anything inside the unsafe zone, is the demo label present on synthetic data, is the right shot on screen for that beat? The tool cannot judge legibility; you can.

Fix list format: beat, problem, which file to change (`script.json`, the capture, the editor), then rebuild and re-check. Common fixes: peaks (limit the master), long silence (tighten the cut), text too small (shorten the headline), black frame at the end (trim the tail).

## Never

Change timing by hand in `build/`, speed up a screen recording without a visible label, or deliver a render that `systm qa-media` marks FAIL.
