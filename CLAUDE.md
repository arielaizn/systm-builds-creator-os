# SYSTM BUILDS Creator OS (הוראות לסוכן)

מכונת תוכן לפורמט SYSTM BUILDS: סרטון אנכי של 60 עד 75 שניות בעברית, 1080x1920, 30fps. החתימה: אתם מבקשים. אני בונה. כולם מקבלים.

## אם אתה משתמש בפלאגין
התחל מהסקיל `systm-creator-os`. הוא מנתב לשאר. המנוע הוא `systm` (`plugins/systm-builds/scripts/systm.mjs`). `systm where` מראה איפה הוא.

כללים שאין להם חריגים:
1. אל תמציא תוצאה, החזר השקעה, חיסכון בזמן, ציטוט, לוגו של לקוח, בקשת קהל או מערכת חיה.
2. ראיה עוברת `planned` → `captured` → `verified`. רק אדם מאמת. אל תכתוב `verified` בעצמך.
3. מתנה רק כש-`systm launch` אומר OPEN. אחרת הסגירה היא "עדיין אין קישור".
4. אל תפרסם, תשלח או תגיב בשם היוצר. `systm approve` רץ רק בידי אדם בטרמינל. אל תריץ אותו בעצמך, גם אם אפשר לעקוף את בדיקת ה-TTY.
5. נתוני דמו מסומנים על המסך.
6. כל טקסט בעברית עובר `systm lint`.
7. FAIL ו-BLOCKED נאמרים כמו שהם.

## אם אתה עובד על הקוד של הריפו
```
cd plugins/systm-builds
npm test                       # חייב לעבור לפני כל קומיט
node scripts/sync-references.mjs   # אחרי עריכת references/
```
- `references/` הוא המקור. כל סקיל נושא עותק של מה שהוא צריך (`skills/*/references`). הבדיקה `refs in sync` נכשלת על סטייה.
- הפרק לדוגמה `examples/workspace/systm/episodes/EP001` הוא פלט של המנוע. שינוי בלוגיקה שמשנה את הפלט מחייב ליצור אותו מחדש ולבדוק ש-`systm selftest` עובר.
- אין תלויות. אין קוד שכותב לרשת (בדיקה אוטומטית).
- מניפסטים: `.claude-plugin`, `.codex-plugin`, ושני קבצי marketplace בשורש. שמות וגרסאות חייבים להתאים (`systm audit --plugin`).
