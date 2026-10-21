---
description: "Run the verifier and the acceptance tests; FAIL and BLOCKED reported as they are"
argument-hint: "[EPxxx] [--stage release] [--plugin] [--run-tests]"
---

Run the `systm-verifier` skill for: $ARGUMENTS. Use the `systm-release-reviewer` agent for an independent read when available.

Engine: `systm ...` if it is on PATH, otherwise `node "${CLAUDE_PLUGIN_ROOT}/scripts/systm.mjs" ...`.
