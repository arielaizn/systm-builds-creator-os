---
description: "Calibrate to the recorded VO, export captions and EDL, run media QA"
argument-hint: "<EPxxx> [video.mp4]"
---

Run the `systm-editor` skill for: $ARGUMENTS. Open the beat frames yourself. Use `systm-sound-director` and `systm-motion-director` for those layers.

Engine: `systm ...` if it is on PATH, otherwise `node "${CLAUDE_PLUGIN_ROOT}/scripts/systm.mjs" ...`.
