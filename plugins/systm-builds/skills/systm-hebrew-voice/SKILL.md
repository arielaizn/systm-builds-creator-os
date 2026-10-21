---
name: systm-hebrew-voice
description: "Copy pass for everything SYSTM BUILDS says or shows: spoken Hebrew VO, on-screen headlines, captions, hooks and platform copy. Runs the deterministic AI-voice lint, rewrites flagged lines in the creator's natural voice, and checks RTL and phone-readable typography. Use after any Hebrew copy is written, or when a line 'sounds like AI'. Triggers: קול, עברית טבעית, ניסוח, לינט, נשמע כמו AI, כתוביות RTL, systm lint."
---

# systm-hebrew-voice

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

Read `references/hebrew-voice.md` once. It lists what the lint catches and the voice of the show.

## Pass

1. `systm lint EPxxx` for the script (VO and overlays), or `systm lint path/to/file.md` for any other text. `systm verify` runs the same rules on the selected hook and the distribution copy.
2. For each ERROR, rewrite the sentence. For each WARN decide: keep with a reason, or change.
3. Rewrite rules:
   - State the fact. If a sentence does not add a fact, a number, a name, a date or an action, delete it.
   - Replace negative parallelism with the one true sentence. "זה לא כלי, זה שיטה" becomes what the thing does.
   - Replace a nominal phrase with a verb: "ביצוע אופטימיזציה של התהליך" becomes "לקצר את התהליך".
   - Mix short and long sentences. Start some with "אבל" or "וגם".
   - Keep the creator's real details: the thing on the screen, the file name, the number the evidence shows.
4. Read it aloud. If the creator would not say it, rewrite it again.
5. Run `systm lint` again. Then `systm build` and `systm verify`, so captions and overlays are regenerated from the new text.

## Before and after

| Before | After |
|---|---|
| לא רק שהכלי מזהה לידים, אלא גם כותב טיוטה | הכלי מזהה את הליד וכותב טיוטה שמחכה לאישור |
| בעולם המהיר של ימינו, מעקב הוא קריטי | ליד שמחכה יומיים לתשובה כבר אצל מישהו אחר |
| לסיכום, זה פתרון מושלם לעסק שלך | עדיין אין קישור להורדה. איזה כלי לבנות אחרי זה? |

(The middle row's "after" is a claim: it needs to be true and backed, or it is rewritten again.)

## Typography

Hebrew lines in captions start with an RLM mark (added by `systm build`). Up to 28 characters per line, two lines, at least 0.8 seconds per cue. Headlines up to 7 words. A bundled or Latin word inside a Hebrew sentence is checked on a rendered frame. See the reference for fonts and the safe zone.

## Done when

`systm lint` is clean or every remaining WARN has a stated reason, and the creator has read the lines aloud.
