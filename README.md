# SYSTM BUILDS · Creator OS

**אתם מבקשים. אני בונה. כולם מקבלים.**

פלאגין אחד ל-Claude Code, Codex ו-OpenClaw שמריץ מכונת תוכן לפורמט של SYSTM BUILDS: סרטון אנכי של 60 עד 75 שניות שבו יוצר בונה כלי עסקי לפי בקשת הקהל, מדגים אותו על מסך אמיתי, נותן גרסה חינמית כשהיא באמת קיימת, ושואל מה לבנות אחר כך.

17 סקילים, 14 פקודות, 3 סוכני עזר ומנוע CLI בלי תלויות (`systm`). הסקילים כותבים ושופטים. המנוע מחשב, מאמת וחוסם.

## מה יוצא מפרק אחד

| שלב | תוצר |
|---|---|
| רעיון | `input.json`, `idea.json`: מוצר אחד, בדיקה אחת, מצב BUILT / PROTOTYPE / DIAGNOSIS |
| הוקים | 12 הוקים בעברית עם ציונים, דירוג דטרמיניסטי, ובחירה שאפשר להוכיח על המסך |
| מעטפ״ה | חמישה צירים (מנגנון, עריכה וצילום, טקסט, פסקול, הוק) עם ציון 0 עד 5 ו-`NOVEL_ELEMENT` אחד |
| תסריט | 13 ביטים עם timecode, VO, טקסט על המסך, נכס, סאונד, שאלת צופה, ראיות וטענות |
| בנייה | `shotlist.csv`, `edl.csv` (פריימים, 30fps), `captions.he.srt/.vtt` עם סימן RLM, `vo.txt`, `sound-cues.csv`, `motion-props.json` |
| אימות | 14 בדיקות עם PASS / WARN / BLOCKED / FAIL, בשלב תכנון ובשלב שחרור |
| שער מתנה | `launch/gate.json`: OPEN רק כשיש קישורים שנבדקו, רישיון, מכסות ועלויות |
| הפצה | תוכנית יבשה לאינסטגרם, טיקטוק, שורטס ולינקדאין עם UTM. שום דבר לא נשלח |
| אריזה | `manifest.json` עם sha256 לכל קובץ ו-`ready_to_publish`, ו-zip |
| מדידה | משפך צפיות, ביקורים, הפעלות, ייעוצים מוסמכים עם רווחי סמך |

דוגמה מלאה שנוצרה בפקודות האלה: [`plugins/systm-builds/examples/workspace/systm/episodes/EP001`](plugins/systm-builds/examples/workspace/systm/episodes/EP001). זה פרק מתוכנן ולא פרק שצולם: כל הראיות בו במצב `planned`, ולכן המאמת בשלב השחרור נכשל, והשער חסום, והסגירה "עדיין אין קישור".

## התקנה

דרישות: Node 20 ומעלה. `ffmpeg` רשות (בדיקת מדיה, פריימים). אין תלויות npm.

### Claude Code

```
/plugin marketplace add arielaizn/systm-builds-creator-os
/plugin install systm-builds@systm-builds-marketplace
```

### Codex

```
codex plugin marketplace add arielaizn/systm-builds-creator-os
```

ואז מתקינים את `systm-builds` מספריית הפלאגינים. ב-Codex מפעילים סקיל בשמו: `$systm-creator-os`.

### OpenClaw

הפלאגין הוא bundle שנקרא גם דרך `.codex-plugin` וגם דרך `.claude-plugin`:

```
git clone https://github.com/arielaizn/systm-builds-creator-os
openclaw plugins install ./systm-builds-creator-os/plugins/systm-builds
openclaw plugins inspect systm-builds
```

### כל סוכן שקורא תיקיות סקילים

```
git clone https://github.com/arielaizn/systm-builds-creator-os && cd systm-builds-creator-os
./install.sh --all          # קישורים סימבוליים ל-~/.claude/skills, ~/.codex/skills, ~/.openclaw/skills + systm ב-~/.local/bin
./install.sh --uninstall    # מסיר רק מה שהסקריפט התקין
```

כל סקיל כולל עותק של ההפניות שהוא צריך, אז הוא עובד גם בלי שאר הפלאגין. את המנוע מריצים דרך `systm` ב-PATH או `node <plugin>/scripts/systm.mjs`.

## הרצה

```
systm doctor                      # M0: סביבה, פונטים בעברית, ffmpeg, דיסק
systm init                        # יוצר systm/ בפרויקט
systm request add --text "..." --channel form --source-ref <קישור> --consent obtained
systm backlog add --title "..." --request R001
systm new EP002 --product "..." --audience "..." --pain "..." --keyword "..." --novel "..."
systm scaffold idea EP002         # ממלאים, ואז: systm idea EP002
systm hooks EP002                 # דירוג 12 הוקים
systm maatpa EP002                # חמישה צירים + רעיון אחד, בדיקת חזרתיות
systm script EP002                # 13 ביטים, הערכת משך
systm build EP002                 # שוטליסט, EDL, כתוביות, קיוז, מושן
systm verify EP002                # שלב תכנון
# מצלמים, מקליטים VO, ואז:
systm script EP002 --calibrate-seconds 68.4 && systm build EP002
systm qa-media systm/out/EP002.mp4 --episode EP002 --frames systm/out/frames
systm verify EP002 --stage release
systm launch EP002 --check-urls   # שער המתנה
systm distribute EP002            # תוכנית הפצה (dry run)
systm package EP002 --zip
systm analyze EP002 --csv data/ep002.csv
```

בסוכן עצמו מדברים בעברית רגילה ("תעשה פרק חדש מהבקשה של..."), או בפקודות (Claude Code):

| פקודה | מה היא עושה |
|---|---|
| `/systm-init` | בדיקת סביבה ויצירת workspace |
| `/systm-idea` | ריאיון, `input.json`, `idea.json` |
| `/systm-episode` | פרק שלם דרך כל השערים, עוצר בכל שלב אנושי |
| `/systm-hooks` | 12 הוקים, דירוג, בחירה |
| `/systm-maatpa` | חמישה צירים ורעיון אחד |
| `/systm-script` | תסריט 13 ביטים בעברית |
| `/systm-shots` | שוטליסט ותוכנית צילום עם רשימת הקלטות |
| `/systm-edit` | כיול לקריינות האמיתית, כתוביות, בדיקת רינדור |
| `/systm-package` | אימות ואריזה |
| `/systm-publish-plan` | טקסטים לפלטפורמות ותוכנית הפצה יבשה |
| `/systm-analyze` | ניתוח משפך והניסוי הבא |
| `/systm-audit` | מאמת וטסטים של קבלה |
| `/systm-series` | בקשות, backlog, חדשנות |
| `/systm-launch` | `product.json` ושער המתנה |

## הסקילים

`systm-creator-os` (כניסה וניתוב) · `systm-setup` · `systm-showrunner` · `systm-series-planner` · `systm-idea-lab` · `systm-hook-lab` · `systm-maatpa-director` · `systm-scriptwriter` · `systm-storyboard-director` · `systm-motion-director` · `systm-editor` · `systm-sound-director` · `systm-verifier` · `systm-product-launch` · `systm-distributor` · `systm-analyst` · `systm-hebrew-voice`.

סוכני עזר ב-Claude Code: `systm-hook-judge` (מדרג הוקים בלי לראות את הציונים של הכותב), `systm-release-reviewer` (מאמת עם וטו, קריאה בלבד), `systm-episode-runner` (מריץ שלבים ועוצר בכל צעד אנושי).

## מה מובטח

1. **אין ראיה מומצאת.** כל "בניתי", "חסכנו שעות", אחוז, סכום, "מאות לקוחות" או ציטוט צריכים טענה רשומה עם ראיה. ראיה עוברת `planned`, `captured`, `verified`, ורק אדם מאמת.
2. **נתוני דמו מסומנים על המסך** ולא מוכיחים החזר השקעה, חיסכון בזמן או הוכחה חברתית.
3. **מתנה רק דרך השער.** בלי קישור אירוח שנבדק, קישור ריפו שנבדק, רישיון אמיתי, מכסות, עלויות, פרטיות, בעיות ידועות ותמיכה, הסגירה היא "עדיין אין קישור".
4. **שום פרסום ושום הודעה.** בקוד אין שליחה לשום שירות. הקריאה היחידה ברשת היא `HEAD` (או `GET` של בייט אחד) ב-`launch --check-urls`, ובדיקה אוטומטית מוודאת את זה. `systm approve` מסרב לרוץ בלי טרמינל אינטראקטיבי ובלי שם של אדם. הוא לא יכול לעצור סוכן שמדמה טרמינל בכוונה, ולכן זה גם כלל קבוע לסוכנים, ו-`systm verify` פוסל אישור שנרשם על שם של סוכן.
5. **הסכמה.** בקשה בלי מקור ובלי הסכמה לא מצוטטת ולא מוצגת.
6. **אין סודות ואין מידע אישי** בתיקיית העבודה (סריקה בכל `verify`).
7. **FAIL ו-BLOCKED נאמרים כמו שהם.** בדיקה שלא רצה היא BLOCKED ולא PASS.

## בדיקות

```
cd plugins/systm-builds
npm test                  # 67 בדיקות: סכמות, לינט עברית, תזמון, כתוביות, מאמת, שער, אנליטיקס, CLI, מדיה
systm selftest            # הפרק לדוגמה נוצר מחדש בייט-בייט מהקבצים שנכתבו
systm audit --plugin --run-tests   # בדיקות הקבלה 10 עד 12
```

`systm audit` מריץ גם `claude plugin validate` אם Claude Code מותקן. אם לא, הבדיקה מסומנת BLOCKED.

## פתרון תקלות

| סימפטום | סיבה ופתרון |
|---|---|
| `systm: command not found` | הפלאגין לא מוסיף את עצמו ל-PATH בכל סוכן. מריצים `node <plugin>/scripts/systm.mjs ...` או `./install.sh` |
| `Missing input.json` | לא באותה תיקיית פרויקט. מריצים מהשורש שבו נמצא `systm/` או מוסיפים `--root <dir>` (בטרמינל zsh לא מעבירים `--root dir` כמשתנה בלי מרכאות) |
| `stale` ב-`systm status` | קובץ מקור השתנה. מריצים מחדש מהשלב שהתיישן, לא מההתחלה |
| V06 FAIL `is stale` | ערכתם קובץ ב-`build/` ביד, או שינית `script.json` בלי `systm build`. `build/` תמיד נגזר |
| V03 WARN על הערכת משך | טבעי עד שמקליטים VO. אחרי ההקלטה: `systm script EPxxx --calibrate-seconds N` |
| V09 FAIL `says "..." with no ... claim` | המשפט טוען משהו שאין לו טענה רשומה. או שמוחקים את המשפט, או שרושמים טענה עם ראיה אמיתית |
| `systm approve` מסרב (קוד 3) | נכון, זה בכוונה. מריצים אותו בעצמכם בטרמינל (ב-Claude Code עם הקידומת `!`) |
| `ffmpeg_subtitles` WARN | ה-ffmpeg שלכם בלי libass. הכתוביות מגיעות כ-SRT/VTT לעורך, בלי צריבה |
| `claude_validate` BLOCKED | Claude Code לא מותקן במחשב שמריץ את ה-audit |

## מגבלות

- **OpenClaw לא נבדק כאן.** המניפסטים וה-bundle בנויים לפי התיעוד של OpenClaw ו-`claude plugin validate` עבר, אבל `openclaw plugins install` לא רץ על מחשב עם OpenClaw. אם הוא נכשל אצלכם, `./install.sh --openclaw` מעתיק את הסקילים ישירות.
- **Codex** לא תומך בפקודות סלאש של Claude. את אותה עבודה עושים הסקילים (`$systm-scriptwriter` וכן הלאה). הסוכנים מוגדרים בפורמט של Claude Code בלבד.
- **אין פרויקט Remotion.** `systm build` כותב `motion-props.json` מדויק לפריים (שמונה ההרכבות), ו-`systm-motion-director` מגדיר איך לבנות מהם. את ההרכבות עצמן בונים עם הכלי שיש לכם.
- **משך התסריט הוא הערכה** (2.7 מילים לשנייה כברירת מחדל) עד שמכיילים מקריינות אמיתית.
- **`ready_to_publish` דורש גם** קריינות מכוילת, בדיקת מדיה על רינדור אמיתי (`systm qa-media --episode`), ובפרק עם מתנה גם `systm launch --check-urls` שעבר.
- **המאמת מחפש תבניות, הוא לא מבין משמעות.** הביטויים ("בניתי", "חסכנו") הם רשימת regex בעברית. טענה שמנוסחת בדרך אחרת נתפסת רק בקריאה של `systm-verifier`. הלינט של קול ה-AI הוא כלל אצבע, לא שופט טעם.
- **בדיקת מדיה** מודדת פורמט, שחורים, עוצמה ושיאים. קריאות בטלפון, סדר הטקסט בעברית ואזור בטוח נבדקים בעין על הפריימים שהיא מוציאה.
- **מגבלות פלטפורמה** (אורך כיתוב, כותרת) הן ברירות מחדל ב-`config.json`. הן משתנות, בודקים מול הפלטפורמה.
- **אין אינטגרציית DM.** הודעה פרטית על מילת מפתח מותרת רק עם `dm.integration_verified: true` ואופט-אאוט, ושום קוד כאן לא שולח אותה.
- הדוגמה EP001 היא תוכנית, לא תוצאה. הנתונים בה ובקובץ האנליטיקס שלה סינתטיים ומסומנים כך.

## מפרט מקור

המפרט שממנו נבנה הפלאגין נשמר ב-[`docs/original-spec`](docs/original-spec). [`docs/SPEC_TRACE.md`](docs/SPEC_TRACE.md) מראה לכל דרישה איפה היא ממומשת ואיזו בדיקה מוכיחה אותה.

רישיון MIT. נבנה בשביל SYSTM על ידי אריאל אייזנשטט.
