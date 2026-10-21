---
name: systm-product-launch
description: "Prepare the free product behind a SYSTM BUILDS episode and run the release gate: product page fields, tested hosted URL and repo URL, real licence, quotas, hosting and API costs, privacy, known issues, support, screenshots, and an honest 'coming soon' close when anything is missing. Use before promising a giveaway, for /systm-launch, or when a viewer asks 'where is the link'. Triggers: מתנה, giveaway, שחרור מוצר, רישיון, קוד פתוח, launch gate, product.json, systm launch."
---

# systm-product-launch

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

"כולם מקבלים" is a promise. This skill decides whether the episode may say it.

## Fill `product.json`

`systm scaffold product EPxxx`, then with the creator:

| Field | What it must be |
|---|---|
| `status` | `BUILT` only if the tool was tested. Otherwise `PROTOTYPE` or `DIAGNOSIS` and the gate stays closed |
| `version` | the version the viewer will get |
| `hosted_url` + `hosted_url_tested` | an https address that the creator opened as a visitor would, with `tested_on` and `tested_by` |
| `repo_url` + `repo_url_tested` | an https address with the real source, opened and checked |
| `license` | an actual licence in the repository (an SPDX id such as `MIT`, `Apache-2.0`, `AGPL-3.0-only`). Public code without a licence is not open source. Ask the creator which they want, and explain the one-line consequence of each: MIT/Apache permit almost any use; AGPL requires sharing changes of hosted copies |
| `install` | steps that work from a clean machine |
| `quotas` | the limits of the hosted free tier |
| `costs` | `hosting`, `api`, `third_party`: who pays, how much, what changes at scale |
| `privacy` | what data is stored, where, for how long, who can see it |
| `known_issues` | real ones. An empty list is not allowed |
| `support` | where to ask for help |
| `screenshots` | files that exist |
| `free_forever_claim` | `true` only with `sustainability_note` that says how it stays free. Otherwise say "free for now" and what could change |

Never invent a URL, a licence, a version or a quota. A blank is better than a guess: it keeps the gate closed and tells the creator what to do.

## Run the gate

```
systm launch EPxxx                 # checks the file
systm launch EPxxx --check-urls    # also sends a read-only HEAD request to both URLs
```

OPEN means every field is real and tested. BLOCKED lists exactly what is missing. Network failure is BLOCKED, not PASS.

## What the gate controls

- `script.cta.type` may be `giveaway` only when OPEN. Otherwise `coming_soon` or `next_request_only`, with no link and no download wording (the verifier fails beat 13 and every caption that promises access while blocked).
- The publish plan only carries links, with UTMs, when OPEN.
- "Keyword in the comments gets the link": only if a working provider integration is verified (`dm.integration_verified`), with an opt-out line. Otherwise a public library link in the first comment. No engagement gating for public source code: the code is available without a like, follow or comment.
- Ask for the next idea in a separate sentence from the giveaway.

## Product repo checklist

README with what it does, the demo, install, run, limits, costs, privacy, known issues, support and licence file. No keys in git. Issues enabled. A tag that matches `version`.

## Done when

The gate says OPEN with every URL opened by a human, or the creator has accepted the "coming soon" close and the script says so.
