# כתר הנדסה — מערכת ניהול פרויקטים

מערכת ווב פנימית לניהול משימות, פרויקטים ולוחות זמנים עבור חברת ניהול ופיקוח
פרויקטי בנייה. נבנתה עם דגש על שיתוף פעולה בין שני השותפים בחברה.

## מה יש במערכת (v1)

- **התחברות** — אימייל וסיסמה אישית לכל שותף: רון (`ronketerltd@gmail.com`)
  וגיא (`guyketerltd@gmail.com`). שינוי סיסמה נעשה ב"הגדרות".
- **חיבור יומן Google** — מתוך "הגדרות". כל שותף יכול לחבר רק את חשבון
  הגוגל שלו (אותו מייל), וכל חשבון אחר נדחה.
- **לוח בקרה** — סיכום כללי: משימות פתוחות ובאיחור, פרויקטים פעילים, עומס
  עבודה לפי שותף, מועדי יעד קרובים, פעילות אחרונה ופילוח פרויקטים לפי סטטוס.
- **המשימות שלי** — לוח קנבן משותף, מסונן כברירת מחדל למשתמש המחובר (לביצוע / בתהליך / לבדיקה / הושלם) עם גרירה
  ושחרור בין עמודות, סינון לפי אחראי/פרויקט/עדיפות, עריכה ומחיקה.
- **מחלקות** — כל פרויקט שייך למחלקה: ניהול ופיקוח – יזמים, או ניהול ופיקוח
  – וילות (`/departments/developer`, `/departments/villa`). פרויקטים שעוד לא
  שויכו מופיעים במסך "שיוך מחלקות" (`/projects`). דף פרויקט מפורט, עם ציר זמן
  של אבני דרך והמשימות המשויכות אליו.
- **תפריט** — מקובץ לפי עבודה יומית / מחלקות / עסק (`src/lib/nav.ts`). בנייד:
  פס תחתון (לוח בקרה, המשימות שלי, יומן) וכפתור "עוד" לתפריט המלא.
- **יומן פגישות** — לוח שנה חודשי משותף לשני השותפים. הסנכרון הדו-כיווני
  עם יומן Google הראשי של כל שותף נמצא בבנייה (שלב 1, חלק 2 ב-`docs/SPEC.md`).
- **פיתוח עסקי** — מעקב נפרד אחר הזדמנויות/לידים להבאת פרויקטים חדשים,
  עם רשימת משימות פתוחה (לא רשימה סגורה) לכל הזדמנות, וכפתור לקביעת
  פגישה שמקשר ישירות ליומן.

## פריסה לאינטרנט (מומלץ — בלי טרמינל, בלי התקנות)

זו הדרך המומלצת אם אין לכם Node.js מותקן, ואם אתם רוצים גם לגלוש למערכת
מהנייד. הכל נעשה דרך הדפדפן: [Neon](https://neon.tech) (מסד נתונים
PostgreSQL בענן, טייר חינמי) + [Vercel](https://vercel.com) (אחסון
האתר, טייר חינמי).

### שלב 1 — יצירת מסד נתונים ב-Neon

1. היכנסו ל-https://neon.tech והירשמו (אפשר עם חשבון Google).
2. צרו פרויקט חדש (Create a project) — אפשר להשאיר את כל ברירות המחדל.
3. במסך שנפתח יופיע **Connection string** — העתיקו אותו. הוא נראה כך:
   `postgresql://user:password@ep-xxxxx.neon.tech/neondb?sslmode=require`
   זה יהיה ה-`DATABASE_URL` שלכם בשלב הבא.

### שלב 2 — פריסה ב-Vercel

1. היכנסו ל-https://vercel.com והירשמו **עם חשבון GitHub** (חשוב שיהיה
   אותו חשבון GitHub שדרכו הריפו הזה נגיש).
2. לחצו **Add New… → Project**, ובחרו את הריפו `23RK/ceter-engineers`.
3. תחת **Branch** בחרו את `claude/keter-engineering-project-management-ir73dj`
   (או `main`, לאחר שהעבודה תמוזג אליו).
4. פתחו את **Environment Variables** והוסיפו:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | ה-connection string מ-Neon (שלב 1) |
   | `SESSION_SECRET` | מחרוזת אקראית וארוכה משלכם (40+ תווים) — למשל תוצאה של [מחולל סיסמאות אקראי](https://1password.com/password-generator) באורך 40. **אל תשתמשו בערך שמופיע במקום אחר בפומבי** — זה המפתח שחותם על ההתחברות שלכם. |
   | `INITIAL_PASSWORD_RON`, `INITIAL_PASSWORD_GUY` | סיסמאות ראשוניות, זמניות. ר' "סיסמאות" למטה. |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `TOKEN_ENCRYPTION_KEY` | לחיבור היומן. ר' "חיבור יומן Google" למטה. |

5. לחצו **Deploy** וחכו כדקה-שתיים. תהליך הבנייה מריץ אוטומטית את הגדרת
   מסד הנתונים ואת הגדרת הסיסמאות הראשוניות — אין צורך בשום פעולה נוספת.
6. בסיום תקבלו קישור כמו `https://ceter-engineers.vercel.app` — זה
   הקישור למערכת, זמין גם מהמחשב וגם מהנייד (אפשר לשמור אותו כקיצור דרך
   על מסך הבית בטלפון).

כל פעם שדוחפים שינוי קוד לענף המחובר, Vercel יבנה ויפרוס גרסה חדשה
אוטומטית לאותו קישור.

## סיסמאות וחיבור יומן Google

כל ההוראות, צעד אחר צעד, נמצאות ב-
[`docs/google-cloud-setup.md`](docs/google-cloud-setup.md):

- **סיסמה ראשונית:** משתני הסביבה `INITIAL_PASSWORD_RON` ו-`INITIAL_PASSWORD_GUY`.
  הסיסמה נקבעת בזמן הפריסה, ורק למי שעוד אין לו סיסמה. אחרי שכל שותף שינה
  את הסיסמה בהגדרות, מוחקים את המשתנים.
- **איפוס סיסמה:** איפוס `passwordHash` ב-Neon, הגדרה מחדש של המשתנה, ו-Redeploy.
- **יומן Google:** ה-Redirect URI הוא
  `https://ceter-engineers.vercel.app/api/google/callback`, ומשתני הסביבה הם
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` ו-`TOKEN_ENCRYPTION_KEY`.
  רק `ronketerltd@gmail.com` ו-`guyketerltd@gmail.com` יכולים להתחבר. זה נאכף
  בקוד, בבדיקות (`npm test`), וב-CHECK במסד הנתונים.

## הרצה מקומית (למי שיש Node.js)

```bash
npm install
cp .env.example .env      # לעדכן DATABASE_URL, SESSION_SECRET ו-INITIAL_PASSWORD_*
                           # (משתני ה-Google רק לחיבור יומן; מקומית: APP_URL=http://localhost:3000
                           #  ו-Redirect URI http://localhost:3000/api/google/callback בקונסול)
npm run db:migrate        # יוצר את הטבלאות במסד הנתונים לפי הסכמה
npm run db:seed           # יוצר את המשתמשים, קובע סיסמאות ראשוניות + נתוני דוגמה
npm test                  # בדיקות (גם רצות אוטומטית בכל build)
npm run dev
```

האתר יעלה בכתובת http://localhost:3000. נכנסים עם המייל והסיסמה הראשונית.

## טכנולוגיה

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Prisma ORM ·
PostgreSQL · כניסה באימייל וסיסמה (bcrypt) + עוגיית session חתומה (JWT,
ללא ספריית auth חיצונית) · Google OAuth (`googleapis`) לחיבור יומן בלבד · React
Server Actions לכל הפעולות (יצירה/עריכה/מחיקה) ללא צורך ב-API נפרד.

פקודת ה-`build` מריצה אוטומטית `prisma migrate deploy` (מעדכן את מבנה
מסד הנתונים) ואת `prisma/seed.ts` (יוצר את המשתמשים המורשים אם הם עוד לא
קיימים) לפני בניית האתר — כך שפריסה ב-Vercel לא דורשת אף פעולת הגדרה ידנית
במסד הנתונים.

## מבנה הפרויקט

```
prisma/schema.prisma        סכמת מסד הנתונים (User, Project, Task, Lead, Meeting, GoogleAccount ...)
prisma/seed.ts              נתוני התחלה: המשתמשים המורשים (רון, גיא) + נתוני דוגמה
src/lib/auth.ts             זיהוי המשתמש המחובר בכל בקשה (requireUser)
src/lib/session.ts          חתימה ואימות של עוגיית ה-session (JWT)
src/lib/crypto.ts           הצפנה/פענוח (AES-256-GCM) לטוקנים של Google
src/lib/google/oauth.ts     OAuth מול Google לחיבור יומן
src/lib/google/calendar-access.ts  מי רשאי לחבר יומן (+ calendar-access.test.ts)
src/lib/actions/*.ts        כל הפעולות מול מסד הנתונים (Server Actions)
src/app/login                מסך הכניסה (אימייל + סיסמה)
src/app/api/google/*         חיבור יומן Google: connect + callback
src/app/(app)/*              העמודים המוגנים: לוח בקרה, משימות, פרויקטים, יומן פגישות, פיתוח עסקי
src/components/*             רכיבי UI
```

## רעיונות להמשך

- ניהול רשימת המורשים דרך ה-UI (הוספת שותף/עובד נוסף)
- תגובות/דיון על משימה ספציפית
- קבצים מצורפים למשימה/פרויקט (מסמכים, תמונות מהאתר)
- תצוגת שבוע ביומן הפגישות (כרגע חודשי בלבד)
