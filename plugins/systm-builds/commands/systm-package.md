---
description: "Verify and package an episode into manifest.json and a zip"
argument-hint: "<EPxxx>"
---

For $ARGUMENTS: run `systm verify`, then `systm verify --stage release` and report both honestly, then `systm package EPxxx --zip`. The manifest must say `ready_to_publish` exactly as the checks say.

Engine: `systm ...` if it is on PATH, otherwise `node "${CLAUDE_PLUGIN_ROOT}/scripts/systm.mjs" ...`.
