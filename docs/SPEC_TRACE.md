# מפרט → מימוש → הוכחה

לכל דרישה במפרט המקורי (`docs/original-spec`): איפה היא ממומשת, ואיזו בדיקה מריצה אותה. מה שלא ממומש כתוב בסוף, בלי ריכוך.

## אבני דרך (M0 עד M6)

| אבן דרך | מצב | איפה |
|---|---|---|
| M0 audit של Node, Claude Code, ffmpeg, פונטים, Remotion והרשאות | נעשה | `systm doctor`, הסקיל `systm-setup` |
| M1 מנוע פרק מקומי וטיפוסי עם CLI | נעשה, עם הערה: סכמות JSON + ולידטור זעיר ב-JavaScript בלי תלויות, לא TypeScript | `scripts/lib`, `schemas/` |
| M2 פלאגין מודולרי לפי הפורמט המאומת | נעשה, אומת מול Claude Code 2.1.306 | `.claude-plugin`, `.codex-plugin`, `claude plugin validate` |
| M3 תסריט, מעטפ״ה, שוטים, EDL, SRT, מניפסט | נעשה | `systm script/maatpa/build/package` |
| M4 Remotion אופציונלי | **חלקי**: חוזה props לכל פריים ושמונה הרכבות מוגדרות. אין פרויקט Remotion ואין רינדור | `build/motion-props.json`, `systm-motion-director` |
| M5 טיוטות הפצה ומתנה בטוחה | נעשה | `systm distribute/launch/approve` |
| M6 אנליטיקס CSV, בדיקות, דוגמה, התקנה, זיפ | נעשה | `systm analyze`, `npm test`, `examples/`, `install.sh`, `systm package --zip` |

## קבלה 1 עד 12

| # | דרישה | בדיקה |
|---|---|---|
| 1 | קלט תקין יוצר סקריפט של 13 ביטים | V01, V02. `cli.test` (new, scaffold), `verify.test` baseline |
| 2 | חמישה צירים ובדיוק רכיב חדשנות אחד | V04. `core.test` maatpa, `verify.test` V04 |
| 3 | 12 הוקים מדורגים ואמיתיים | V05. `core.test` hooks, `schemas/hooks` (בדיוק 12) |
| 4 | שוטליסט, EDL, VO, SRT/VTT | V06. `cli.test` idempotent, `verify.test` V06 |
| 5 | RTL וטיפוגרפיה לנייד | V07, V08. `core.test` captions, `verify.test` V08 |
| 6 | בלי ציטוט, ROI או הוכחת לקוח מומצאים | V09, V10. שבע בדיקות ב-`verify.test` |
| 7 | מתנה חסומה בלי קישורים או רישיון | V11, `launch`. `core.test` gate, `verify.test` V11 |
| 8 | בלי סודות או מידע אישי | V12. `verify.test` V12 |
| 9 | בלי כתיבה מרחוק בלי אישור | V13, `approve`. `core.test` (אין קוד כתיבה לרשת), `cli.test` approve |
| 10 | הדוגמה משתחזרת והבדיקות עוברות | `systm selftest`, `npm test`, `audit --run-tests` |
| 11 | סכמת הפלאגין מאומתת מול גרסת Claude Code המותקנת | `audit --plugin` מריץ `claude plugin validate`. אם Claude Code לא מותקן: BLOCKED |
| 12 | README עם התקנה, הרצה, פתרון תקלות ומגבלות | `audit --plugin` בודק את הכותרות |

## מסמכי המפרט

| מסמך | דרישה | מימוש |
|---|---|---|
| SHOW_BIBLE | שלושה מצבים BUILT / PROTOTYPE / DIAGNOSIS | `model.mjs`, כללי V09 ו-V11, `templates/SHOW_BIBLE.md` |
| SHOW_BIBLE | מוצר אחד ובדיקה אחת, מדדי הצלחה הם הפעלות ופניות | `idea.schema`, `analytics.mjs` (כותרת: הפעלות ל-1000 צפיות) |
| MASTER | תוצר לכל ציר: בחירה, למה, זמן, נכס, מימוש, סיכון, מדד, תיקון, ציון. מתחת ל-3 מתקנים | `maatpa.schema`, `maatpaIssues` |
| MASTER | שאלות פתוחות ב-3, 15, 35, 55 | `maatpa.schema` (`at_s` enum), `VIEWER_Q_TIMES` |
| MASTER | 12 חלופות הוק, ציון לפי התאמה, סקרנות, ספציפיות, הוכחה וחוזק חזותי | `hooks.schema`, `rankHooks` (משקלים ב-`model.mjs`) |
| VARIATIONS | קטלוג חדשנות, אחד לפרק | `NOVELTY`, `noveltyConflicts` (חלון של שלושה פרקים) |
| 13_BEATS | לכל ביט: timecode, עברית, טקסט, נכס, סאונד, שאלה, ראיה, מעבר | `script.schema`, `references/13-beats.md` (כולל 3 גרסאות, טעויות וקבלה לכל ביט) |
| WRITING | שדות הקלט | `input.schema` (גם `"observed need"` עם רווח, כמו בקובץ המקור) |
| WRITING | אין "בניתי" או "חסכתי שעות" בלי הוכחה | `verify.mjs` TRIGGERS, `verify.test` |
| WRITING | אין מתנה בלי קישורים: CTA כנה | V11, `cta.type`, `launch` |
| WRITING | 60 עד 75 שניות לפי מהירות ההקלטה בפועל | `script --calibrate-seconds`, V03 |
| PRODUCTION | עמודות שוטליסט ו-EDL | `exporters.mjs`, `references/file-contracts.md` |
| PRODUCTION | SRT/VTT עברית RTL, 1 עד 2 שורות | `splitCaptions`, סימן RLM, V07 |
| PRODUCTION | בדיקת קריאות בנייד, פריימים שחורים, קליפינג, אורך, שיאים | `systm qa-media` + פריימים לבדיקה בעין |
| PRODUCTION | הרכבות Remotion מ-JSON | `motion-props.json` (חלקי, ראו M4) |
| DISTRIBUTION | שדות דף מוצר | `product.schema`, `launch.mjs` |
| DISTRIBUTION | DM על מילת מפתח רק אם האינטגרציה עובדת | `distributionIssues` (`integration_verified`, opt-out) |
| DISTRIBUTION | בלי התניית קוד ציבורי בהתנהגות | הסקיל `systm-product-launch` (כלל בטקסט, לא נאכף בקוד) |
| DISTRIBUTION | IG, סטורי, TikTok, Shorts, LinkedIn, תמונה ממוזערת, alt, UTM, A/B | `distribution.schema`, `distribute.mjs` |
| DISTRIBUTION | מעקב צפיות → ביקורים → הפעלות → פניות | `analytics.mjs` |
| DISTRIBUTION | אישור מפורש לפני פרסום | `approve` (טרמינל אינטראקטיבי בלבד), V13 |
| ARCHITECTURE | 12 מודולים | 12 סקילים עם אותם שמות (קידומת `systm-`), ועוד ארבעה: `creator-os`, `setup`, `series-planner`, `sound-director`, `hebrew-voice` |
| ARCHITECTURE | 12 פקודות | `commands/` (14, כולל `/systm-series` ו-`/systm-launch`) |
| ARCHITECTURE | JSON + Markdown לכל מעבר, `episode_id`, provenance, ראיות, אזהרות, סטטוס | מעטפת בכל קובץ. `provenance.inputs[].sha256`, `systm status` מזהה `stale` |
| ARCHITECTURE | מקומי, דטרמיניסטי, אידמפוטנטי | `buildAll` פונקציה טהורה. `cli.test` idempotent. `systm selftest` |
| ARCHITECTURE | סוכנים לא ממציאים ראיות, למאמת יש וטו | V09, `systm-verifier`, הסוכן `systm-release-reviewer` |
| INTEGRATIONS | dry-run ואישור ידני כברירת מחדל | `plan.dry_run`, V13 |
| INTEGRATIONS | אינטגרציות אופציונליות (GitHub, טפסים, API חברתיים, DM) | **לא ממומש.** הפלאגין לא מתחבר לשום שירות. הקריאה היחידה ברשת היא `HEAD` ב-`launch --check-urls` |
| INTEGRATIONS | retry, rate limits, idempotency של שליחה | לא רלוונטי: אין שליחה |

## חריגות מהמפרט, במפורש

1. **JavaScript במקום TypeScript.** כדי שיהיה אפס build ואפס תלויות בשלוש הסביבות. הטיפוסים הם `schemas/*.schema.json`.
2. **אין פרויקט Remotion.** ראו M4.
3. **OpenClaw לא נבדק במחשב עם OpenClaw.** ראו README.
4. **`audit` סעיף 10 עד 12** מסמן BLOCKED כשאי אפשר להריץ אותם, למשל בלי Claude Code, ולא PASS.
