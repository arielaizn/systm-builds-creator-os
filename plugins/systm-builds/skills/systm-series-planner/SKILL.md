---
name: systm-series-planner
description: "Run the SYSTM BUILDS content loop across episodes: log audience requests with source and consent, keep the backlog, pick the next build, track which NOVEL_ELEMENTs were used, and design the 'what should I build next?' question. Use for 'what should the next episode be', logging a comment or DM as a request, or planning a batch of episodes. Triggers: בקשות, backlog, מה לבנות הבא, תכנון סדרה, אתם מבקשים, novelty."
---

# systm-series-planner

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

The show promises "you ask, I build". This skill keeps that promise honest and makes the loop run every week.

## The loop

1. **Collect.** Requests come from comments, DMs, forms, email, conversations. Only real ones.
2. **Log each one** with `systm request add --text "<exact words>" --channel <instagram_comment|dm|form|email|in_person|other> --source-ref <permalink or file> --consent <obtained|pending|none>`.
   - The text is verbatim. Never reword a request to make it sound better.
   - `--source-ref` says where it really was written. Without it, the request is unverifiable and cannot be shown on screen as a request.
   - Consent means the person agreed to be quoted or shown. `pending` and `none` mean the idea may be used, the person may not be quoted or identified.
   - No handles, names or phone numbers in `--text`. Use `--author-ref` with an opaque id the creator controls.
3. **Queue** with `systm backlog add --title "<tool idea>" [--request R001] [--priority 1-5]`.
4. **Pick** with `systm backlog next`: consented requests first, then requests without consent, then observed needs.
5. **Check novelty**: `systm novelty` lists every NOVEL_ELEMENT used so far. The next episode needs one that is new inside the last three episodes. Propose two or three from `references/maatpa.md`.
6. **Open the episode**: `systm new EPxxx --request R001 ...`, then `systm-idea-lab`.
7. **After publishing**: `systm backlog set B001 --status published` and feed analytics to `systm-analyst`.

## Choosing what to build

Rank queued items by: (a) one product and one demonstrable test fit in 60 to 75 seconds, (b) a business owner recognises the pain at once, (c) it can honestly reach BUILT, or at least PROTOTYPE, in the time available, (d) it has an edge case worth stress-testing on camera. Say which items fail (a) or (c) and why. A request that needs a month is a series, not an episode.

## The question at the end

The ask is a separate sentence from the giveaway. It names the audience and is answerable in one line: "איזה כלי לעסק לבנות אחרי זה?" Rotate between an open question and a two-option vote. Do not ask for follows or shares as a condition.

## Cadence

Plan in batches of three: one BUILT, one PROTOTYPE, one backup. Never schedule an episode as BUILT before the tool is tested. Flag when the backlog has fewer than two consented requests: the show is running on observed needs and the line "אתם מבקשים" should be used carefully.

## Never

Invent a request, paraphrase one into a quote, scrape comments or profiles for personal data, or treat silence as consent.
