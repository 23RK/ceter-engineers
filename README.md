# כתר הנדסה — מערכת ניהול פרויקטים

מערכת ווב פנימית לניהול משימות, פרויקטים ולוחות זמנים עבור חברת ניהול ופיקוח
פרויקטי בנייה. נבנתה עם דגש על שיתוף פעולה בין שני השותפים בחברה.

## מה יש במערכת (v1)

- **התחברות** — "כניסה עם Google" אישית לכל משתמש. רק המיילים שמופיעים
  ברשימת המורשים (טבלת `User`) יכולים להיכנס: רון, גיא, ומנהל המערכת
  (`keterengineers@gmail.com`). כל מייל אחר נחסם.
- **לוח בקרה** — סיכום כללי: משימות פתוחות ובאיחור, פרויקטים פעילים, עומס
  עבודה לפי שותף, מועדי יעד קרובים, פעילות אחרונה ופילוח פרויקטים לפי סטטוס.
- **משימות** — לוח קנבן משותף (לביצוע / בתהליך / לבדיקה / הושלם) עם גרירה
  ושחרור בין עמודות, סינון לפי אחראי/פרויקט/עדיפות, עריכה ומחיקה.
- **פרויקטים** — רשימת פרויקטים עם סטטוס, לקוח, כתובת ותקציב; דף פרויקט
  מפורט עם ציר זמן של אבני דרך והמשימות המשויכות אליו.
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
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `TOKEN_ENCRYPTION_KEY` | ר' "הגדרת כניסה עם Google" למטה. בלעדיהם אי אפשר להיכנס למערכת. |

5. לחצו **Deploy** וחכו כדקה-שתיים. תהליך הבנייה מריץ אוטומטית את הגדרת
   מסד הנתונים ואת יצירת חשבון ההתחברות — אין צורך בשום פעולה נוספת.
6. בסיום תקבלו קישור כמו `https://ceter-engineers.vercel.app` — זה
   הקישור למערכת, זמין גם מהמחשב וגם מהנייד (אפשר לשמור אותו כקיצור דרך
   על מסך הבית בטלפון).

כל פעם שדוחפים שינוי קוד לענף המחובר, Vercel יבנה ויפרוס גרסה חדשה
אוטומטית לאותו קישור.

## הגדרת כניסה עם Google

הכניסה למערכת היא רק דרך "כניסה עם Google". אותו חיבור משמש גם לסנכרון
היומן: שותף שנכנס בפעם הראשונה מתבקש לאשר גישה ליומן Google שלו (קריאה
וכתיבה של אירועים). מנהל המערכת לא מתבקש לאשר יומן.

ההוראות המלאות, צעד אחר צעד, להגדרה ב-Google Cloud Console נמצאות ב-
[`docs/google-cloud-setup.md`](docs/google-cloud-setup.md). בקצרה:

1. פרויקט ב-Google Cloud עם **Google Calendar API** פעיל.
2. **OAuth consent screen** מסוג External, במצב **In production** (לא
   Testing, אחרת ה-refresh token פג אחרי 7 ימים).
3. **OAuth client** מסוג Web application, עם Redirect URI:
   `https://<הקישור-שלכם>/api/auth/google/callback`.
4. ב-Vercel, משתני הסביבה:

   | Name | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | מה-Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | מה-Google Cloud Console |
   | `APP_URL` | הקישור המלא לאתר, בלי `/` בסוף, למשל `https://ceter-engineers.vercel.app` |
   | `TOKEN_ENCRYPTION_KEY` | 64 תווים הקסדצימליים אקראיים (`openssl rand -hex 32`). מצפין את ה-tokens של Google במסד הנתונים. **לא לשתף בשום מקום.** |

### הוספה או הסרה של משתמש מורשה

רשימת המורשים היא טבלת `User`: כל שורה עם `email` יכולה להיכנס. כרגע אין
לזה מסך ניהול. מוסיפים או מסירים שורה דרך Neon (SQL Editor) או
`npm run db:studio`. המייל נשמר באותיות קטנות.

## הרצה מקומית (למי שיש Node.js)

```bash
npm install
cp .env.example .env      # לעדכן DATABASE_URL, SESSION_SECRET ומשתני ה-Google
                           # (APP_URL=http://localhost:3000, ולהוסיף את
                           #  http://localhost:3000/api/auth/google/callback כ-Redirect URI בקונסול)
npm run db:migrate        # יוצר את הטבלאות במסד הנתונים לפי הסכמה
npm run db:seed           # יוצר את המשתמשים המורשים + נתוני דוגמה
npm run dev
```

האתר יעלה בכתובת http://localhost:3000. נכנסים עם אחד מהמיילים המורשים.

## טכנולוגיה

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Prisma ORM ·
PostgreSQL · "כניסה עם Google" (OAuth דרך `googleapis`) + עוגיית session
חתומה (JWT, ללא ספריית auth חיצונית) · React
Server Actions לכל הפעולות (יצירה/עריכה/מחיקה) ללא צורך ב-API נפרד.

פקודת ה-`build` מריצה אוטומטית `prisma migrate deploy` (מעדכן את מבנה
מסד הנתונים) ואת `prisma/seed.ts` (יוצר את המשתמשים המורשים אם הם עוד לא
קיימים) לפני בניית האתר — כך שפריסה ב-Vercel לא דורשת אף פעולת הגדרה ידנית
במסד הנתונים.

## מבנה הפרויקט

```
prisma/schema.prisma        סכמת מסד הנתונים (User, Project, Task, Lead, Meeting, GoogleAccount ...)
prisma/seed.ts              נתוני התחלה: המשתמשים המורשים (רון, גיא, מנהל מערכת) + נתוני דוגמה
src/lib/auth.ts             זיהוי המשתמש המחובר בכל בקשה (requireUser)
src/lib/session.ts          חתימה ואימות של עוגיית ה-session (JWT)
src/lib/crypto.ts           הצפנה/פענוח (AES-256-GCM) לטוקנים של Google
src/lib/google/oauth.ts     תהליך ה-OAuth מול Google (כניסה + הרשאת יומן)
src/lib/actions/*.ts        כל הפעולות מול מסד הנתונים (Server Actions)
src/app/login                מסך הכניסה עם Google
src/app/api/auth/google/*    נקודות הקצה של ה-OAuth (התחלה + callback)
src/app/(app)/*              העמודים המוגנים: לוח בקרה, משימות, פרויקטים, יומן פגישות, פיתוח עסקי
src/components/*             רכיבי UI
```

## רעיונות להמשך

- ניהול רשימת המורשים דרך ה-UI (הוספת שותף/עובד נוסף)
- תגובות/דיון על משימה ספציפית
- קבצים מצורפים למשימה/פרויקט (מסמכים, תמונות מהאתר)
- תצוגת שבוע ביומן הפגישות (כרגע חודשי בלבד)
