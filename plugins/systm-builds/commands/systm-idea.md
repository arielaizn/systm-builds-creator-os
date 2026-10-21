---
description: "Shape one episode idea into input.json and idea.json"
argument-hint: "<tool idea | request id | pain>"
---

Run the `systm-idea-lab` skill for: $ARGUMENTS. Interview first, never invent a request or a result. Pick the next free EPxxx from `systm status`.

Engine: `systm ...` if it is on PATH, otherwise `node "${CLAUDE_PLUGIN_ROOT}/scripts/systm.mjs" ...`.
