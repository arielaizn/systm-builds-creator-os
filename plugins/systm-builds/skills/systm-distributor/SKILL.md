---
name: systm-distributor
description: "Write and check the SYSTM BUILDS distribution package and a dry-run publish plan: Instagram caption and story teaser, TikTok caption, YouTube Shorts title and description, LinkedIn B2B caption, thumbnail text, alt text, UTM links, A/B hooks and the comment-keyword policy, with explicit human approval before anything is posted or sent. Use for /systm-publish-plan, 'captions for the platforms', 'plan the posting'. Triggers: הפצה, כיתוב, אינסטגרם, טיקטוק, שורטס, לינקדאין, UTM, distribute, publish plan."
---

# systm-distributor

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

The plugin plans. A human posts. Nothing in this plugin can post, comment, send a message or call a platform API.

## Write `distribution.json`

`systm scaffold distribution EPxxx`, then fill every field. Read `script.json`, `hooks.json` and the launch gate first (`systm launch EPxxx`).

| Field | Guidance |
|---|---|
| `platforms.instagram.caption` | opens with the selected hook; one line on the product; one line on the limitation or the gate state; the question for the next build. Keyword line only if `link_policy` is `keyword_dm` |
| `platforms.instagram.story_teaser` | one line that sets up the stress test |
| `platforms.tiktok.caption` | shorter; the test, the label for demo data, the ask |
| `platforms.shorts.title` | up to 100 characters, specific, no clickbait the video does not pay off |
| `platforms.shorts.description` | what was tested, the honest status, the ask |
| `platforms.linkedin.caption` | B2B: the business process, the owner and next action, the limitation, the ask. No "game changer" language |
| `thumbnail_text` | up to 5 words, the test or the result, in the brand colours |
| `alt_text` | describes what is visible, in plain Hebrew |
| `ab_hooks` | the selected hook plus two others from `hooks.json`, with their ids |
| `link_policy` | `library_link` (default) or `keyword_dm` |
| `dm` | for `keyword_dm`: `integration_verified: true` only if a real integration was tested, `opt_out_text`, `provider` |

Copy rules: Hebrew, spoken, lint-clean (`systm lint`). If the gate is BLOCKED, no copy may promise access: say "עדיין אין קישור" and mean it. Mark demo data as demo in the caption too.

## Run

```
systm distribute EPxxx
```

It validates platform limits (they change, so confirm the current ones in the platform's own tools), checks the copy against the gate, builds UTM links (`utm_source`, `utm_medium=organic_social`, `utm_campaign=ep001`, `utm_content=<hook id>`, `utm_term=<keyword>`) only when the gate is OPEN, and writes `distribute/plan.json`, `plan.md` and `utm.csv`. The plan always has `dry_run: true` and `remote_writes: []`.

## Approval

Each platform item has a content hash. The creator approves each one by running `systm approve EPxxx --action post:instagram --by "<name>"` at a terminal and typing the first 8 characters of the hash. The command refuses to run without a person at an interactive terminal (in Claude Code, the creator types it with the `!` prefix). You never run it for them and never record an approval yourself. Changing the copy changes the hash and cancels the approval.

## Measure

The funnel to track is views, visits, activations, qualified consultations. The UTMs make visits attributable. Hand the data to `systm-analyst`.

## Never

Post, DM or comment from here; scrape commenters; trigger automation from a keyword unless the integration is verified and has an opt-out; collect personal data without consent; claim "free forever" without the sustainability note.
