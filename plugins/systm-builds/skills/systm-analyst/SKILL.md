---
name: systm-analyst
description: "Analyse SYSTM BUILDS analytics honestly: import a CSV of views, visits, activations and qualified consultations per platform and episode, compute funnel rates with 95% confidence intervals and activations per 1,000 views, flag small samples and data errors, and propose the next single-variable experiment without causal claims. Use for /systm-analyze, 'how did the episode do', 'which hook worked'. Triggers: אנליטיקס, ניתוח ביצועים, משפך, activations, analyze, CSV, ביצועי פרק."
---

# systm-analyst

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Success is activated users and qualified business inquiries. Views are context.

## Input

A CSV with a header and one row per day and platform: `date, platform, episode_id, views, visits, activations, consultations`. Optional `avg_view_duration_s`. Sources the creator controls: native analytics exports, the UTM-tagged visits from the hosted tool, sign-ups, and consultation requests they qualified themselves. Ask what "activation" and "qualified consultation" mean for this product and write the definition at the top of the report. Do not scrape comments or profiles.

```
systm analyze EP001 --csv data/ep001.csv
systm analyze all --csv data/all.csv        # prints totals only
systm analyze EP001 --csv sample_SYNTHETIC.csv   # a filename with SYNTHETIC, or --synthetic, labels everything
```

Writes `analytics/analysis.json` and `analysis.md`.

## How to read it

- Headline: activations and consultations per 1,000 views, per platform.
- Each rate has a Wilson 95% interval. Overlapping intervals mean the data does not show a difference. Say so.
- `confidence`: `very_low` (< 1,000 views), `low` (< 100 visits or < 30 activations), `usable`. Below `usable`, no strategy change.
- `data_issues` (visits above views, negatives, missing values) are reported first. Fix the export before interpreting.
- SYNTHETIC data is never quoted as a result, in a caption, a deck or a claim.

## What you may and may not say

May: "Instagram had 1.2 activations per 1,000 views, TikTok 1.1, and the intervals overlap, so no difference is shown." "Visits per view was higher for EP002, which used a result-first hook; two episodes cannot tell us the hook is the reason."
May not: that a hook, a novelty element, a platform or a posting time caused a result; trends from fewer than three episodes; ROI from views.

## Recommendation format

One next experiment, one variable (it will be the next NOVEL_ELEMENT or the A/B hook), what you will measure, the minimum sample before deciding, and the stop rule. Example: "EP003: same format, change only the hook type to `constraint_first`. Compare activations per 1,000 views across EP001 to EP003 once each has at least 1,000 views and 30 activations. If intervals overlap, keep the hook that is easier to prove on screen."

## Feed back

Give the creator the one-line learning for `systm-series-planner` (which requests, which pain, which format) and mark the backlog item published.
