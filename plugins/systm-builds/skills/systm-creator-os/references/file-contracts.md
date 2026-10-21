# חוזי קבצים

כל שלב כותב JSON מגרסה (`schema: "systm/<stage>@1"`) ו-Markdown לקריאה. הסכמות המלאות ב-`schemas/`. דוגמה חיה: `examples/workspace/systm/episodes/EP001/`.

כל קובץ JSON נושא `episode_id`, `status` (`draft` · `ready` · `needs_revision` · `blocked`), `warnings`, `evidence_refs` ו-`provenance` (נכתב על ידי המנוע: השלב, הגרסה וה-sha256 של קבצי המקור). שינוי בקובץ מקור מסמן את מה שמעליו כ-`stale` ב-`systm status`.

| שלב | קובץ | נכתב על ידי | נגזר ממנו |
|---|---|---|---|
| קלט | `input.json` | אדם או `systm new` | |
| רעיון | `idea.json` | סוכן | input |
| הוקים | `hooks.json` + `hooks.md` | סוכן, דירוג על ידי המנוע | input, idea |
| מעטפ״ה | `maatpa.json` + `maatpa.md` | סוכן | input, hooks |
| תסריט | `script.json` + `script.md` | סוכן | input, maatpa, hooks |
| בנייה | `build/*` | המנוע בלבד | script |
| אימות | `verify/report.json` + `.md` | המנוע | input, script, build |
| אריזה | `package/manifest.json` | המנוע | script, build, verify |
| הפצה | `distribution.json` → `distribute/plan.json` | סוכן → המנוע | script |
| מוצר | `product.json` → `launch/gate.json` | אדם → המנוע | |
| אנליטיקס | `analytics/analysis.*` | המנוע | CSV |

`build/` הוא פונקציה טהורה של `script.json` והגדרות: `timing.json`, `vo.txt`, `shotlist.csv`, `edl.csv`, `captions.he.srt`, `captions.he.vtt`, `sound-cues.csv`, `motion-props.json`. לא עורכים אותם ביד. `systm verify` מזהה עריכה ידנית כקובץ ישן.

## עמודות
- shotlist: `id, beat, in, out, mode, asset, framing, action, overlay, audio, evidence` (timecode `HH:MM:SS:FF`)
- edl: `start_frame, end_frame, asset, transform, caption, sfx, transition` (סוף בלעדי, רציף, בלי חורים)
- sound-cues: `time_tc, time_s, beat, type, asset, license, duck_db, note`

## הרצת הצינור
```
systm init
systm new EP002 --product "..." --audience "..." --pain "..." --keyword "..." --novel "..."
systm scaffold idea EP002        # ואז ממלאים ורצים: systm idea EP002
systm scaffold hooks EP002       # systm hooks EP002
systm scaffold maatpa EP002      # systm maatpa EP002
systm scaffold script EP002      # systm script EP002, systm build EP002
systm verify EP002               # שלב plan
systm launch EP002               # שער מתנה
systm distribute EP002           # תוכנית הפצה (dry run)
systm package EP002 --zip
```
