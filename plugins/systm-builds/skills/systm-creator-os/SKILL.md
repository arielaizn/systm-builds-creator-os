---
name: systm-creator-os
description: "Entry point and router for SYSTM BUILDS Creator OS, a content machine for the 60-75 second vertical Hebrew format where a creator builds a business tool from audience requests, demos it for real, gives away a free basic version and asks what to build next. Use first for any SYSTM BUILDS episode, idea, script, shotlist, edit, distribution or analytics request, or when unsure which systm-* skill to run. Triggers: SYSTM BUILDS, פרק חדש, מכונת תוכן, אתם מבקשים אני בונה כולם מקבלים, מעטפ״ה, 13 ביטים."
---

# SYSTM BUILDS Creator OS

**The show.** אתם מבקשים. אני בונה. כולם מקבלים. A creator builds useful business software from audience requests, shows real behaviour on screen, gives away a hosted free basic version plus source code when it exists, and asks what to build next. Audience: business owners, CEOs, operations and sales. Format: 9:16, 1080x1920, 30fps, 60 to 75 seconds. Brand: #0B0B0C, #7FD4FF, white. Success is activated users and qualified business inquiries, not views.

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

## The pipeline

```
request / observed need -> idea -> 12 hooks -> MAATPA -> 13-beat script -> build (shots, EDL, captions, VO, sound cues, motion props)
   -> verify -> [shoot, record VO, calibrate, edit] -> release verify -> launch gate -> publish plan -> package -> analyze -> next request
```

| Step | Skill | CLI |
|---|---|---|
| Set up, check the machine | `systm-setup` | `systm doctor`, `systm init` |
| Run a whole episode | `systm-showrunner` | `systm status EPxxx` |
| Requests, backlog, novelty | `systm-series-planner` | `systm request`, `systm backlog`, `systm novelty` |
| Shape the idea | `systm-idea-lab` | `systm new`, `systm idea` |
| 12 scored hooks | `systm-hook-lab` | `systm hooks` |
| Five axes + one NOVEL_ELEMENT | `systm-maatpa-director` | `systm maatpa` |
| 13-beat script | `systm-scriptwriter` | `systm script`, `systm lint` |
| Shotlist and shoot plan | `systm-storyboard-director` | `systm build` |
| Motion graphics | `systm-motion-director` | `motion-props.json` |
| Edit, captions, media QA | `systm-editor` | `systm qa-media` |
| Music, SFX, silence | `systm-sound-director` | `sound-cues.csv` |
| Truth gate | `systm-verifier` | `systm verify`, `systm audit` |
| Product page and giveaway gate | `systm-product-launch` | `systm launch` |
| Captions per platform, UTMs | `systm-distributor` | `systm distribute` |
| Funnel analysis | `systm-analyst` | `systm analyze` |
| Hebrew copy pass | `systm-hebrew-voice` | `systm lint` |

## Rules that never bend

1. **No invented proof.** No result, ROI, saved time, customer quote, customer logo, audience request or live system that does not exist. If it is not recorded in the evidence ledger, it is not said.
2. **Evidence moves `planned` -> `captured` -> `verified`, and only a human verifies.** An agent asks the creator to open the file and confirm.
3. **One product, one test, one NOVEL_ELEMENT per episode.**
4. **Giveaway only through the gate.** `systm launch` must say OPEN. Otherwise the close is an honest "coming soon" with no link.
5. **Nothing is posted, sent or DM'd by this plugin.** It has no such code. A human posts. `systm approve` needs a person at a terminal.
6. **Synthetic data is labelled on screen** (`נתוני דמו`) and never backs ROI, time saved, social proof or quotes.
7. **Hebrew first, RTL, phone-readable.** Every spoken or on-screen line passes `systm lint`.
8. **No secrets, no personal data** in the workspace. Blur PII in screen captures. Protect the creator's likeness and voice as approved.
9. **Say FAIL and BLOCKED when they are true.** Never mark a check PASS to move on.
10. **Do not run a stage on top of a failing earlier stage.** `systm status` shows what is stale.

## First move

- No `systm/` folder: run `systm-setup`.
- A creator brings an audience request or a tool idea: `systm-series-planner`, then `systm-idea-lab`.
- "Make the episode": hand over to `systm-showrunner`, which runs the stages in order and stops at every point where a human has to act.
- A single stage: go straight to its skill.

Answer in Hebrew unless the user writes in another language. Keep chat answers short and concrete: what was done, what failed, what is next.

Reference files: `references/file-contracts.md` (every stage file), `references/evidence-rules.md`, `references/13-beats.md`, `references/maatpa.md`, `references/hebrew-voice.md`.
