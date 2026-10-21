---
description: "Run or resume a whole SYSTM BUILDS episode through every gate"
argument-hint: "<EPxxx | new from backlog>"
---

Run the `systm-showrunner` skill for: $ARGUMENTS. Start with `systm status`. Stop at every human step and say exactly what the creator must do.

Engine: `systm ...` if it is on PATH, otherwise `node "${CLAUDE_PLUGIN_ROOT}/scripts/systm.mjs" ...`.
