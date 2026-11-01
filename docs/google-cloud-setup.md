# הגדרת Google Cloud Console: כניסה עם Google ויומן

מדריך חד-פעמי. לוקח כ-15 דקות. כל הצעדים חינמיים.

> **שמות בקונסול:** גוגל העבירה את הגדרות ה-OAuth לאזור בשם **Google Auth Platform**, עם הלשוניות Branding, Audience, Clients ו-Data Access. בפרויקטים ישנים זה עדיין מופיע כ-**APIs & Services → OAuth consent screen / Credentials**. התוכן זהה, רק המיקום שונה.

---

## צעד 1: לבחור את הפרויקט

1. היכנסו ל-https://console.cloud.google.com עם **`keterengineers@gmail.com`**. מומלץ שהפרויקט יהיה בבעלות חשבון החברה, ולא חשבון אישי.
2. בתפריט העליון (ליד הלוגו של Google Cloud) בחרו את הפרויקט הקיים של כתר הנדסה, אם נוצר כזה בעבר. אחרת: **New Project**, שם "כתר הנדסה", ואז **Create**.

## צעד 2: להפעיל את Google Calendar API

1. בשורת החיפוש העליונה כתבו **Google Calendar API** ופתחו אותו.
2. לחצו **Enable**. אם כתוב **Manage**, ה-API כבר פעיל וממשיכים הלאה.

## צעד 3: מסך ההסכמה (Branding + Audience)

1. בחיפוש העליון כתבו **Google Auth Platform**, או נווטו ל-**APIs & Services → OAuth consent screen**.
2. אם מופיע **Get started**, מלאו:
   - **App name:** `כתר הנדסה`
   - **User support email:** `keterengineers@gmail.com`
   - **Audience:** **External**
   - **Contact information:** `keterengineers@gmail.com`
   - סמנו את ההסכמה למדיניות ולחצו **Create**.
3. בלשונית **Branding**:
   - **אל תעלו לוגו.** העלאת לוגו מחייבת תהליך אימות מול גוגל, ובלעדיו האפליקציה לא תעבוד עד שהאימות יאושר.
   - את **Authorized domains** ואת קישורי ה-homepage וה-privacy policy השאירו ריקים.

## צעד 4: ההרשאות (Data Access)

1. לשונית **Data Access**, ואז **Add or remove scopes**.
2. סמנו את שלוש ההרשאות הבאות. אם אחת מהן לא מופיעה ברשימה, הדביקו אותה בתיבה **Manually add scopes** בתחתית החלון:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/calendar.events`
3. **Update**, ואחר כך **Save**.

> אם בעבר הוגדרה ההרשאה הרחבה `https://www.googleapis.com/auth/calendar`, אפשר להסיר אותה. המערכת כבר לא צריכה אותה.

## צעד 5: מעבר ל-"In production" (חשוב!)

1. לשונית **Audience**.
2. תחת **Publishing status** לחצו **Publish app**, ואז **Confirm**.
3. הסטטוס צריך להתחלף ל-**In production**.

> **למה זה חשוב:** במצב **Testing**, גוגל מבטלת את הרשאת היומן אחרי 7 ימים, והסנכרון נשבר בלי שום הודעה.
>
> **האם נדרש אימות מגוגל?** לא. אפליקציה עם פחות מ-100 משתמשים יכולה לעבוד במצב In production בלי אימות. ייתכן שתופיע הודעה שהאפליקציה "needs verification". אפשר להתעלם ממנה: כל משתמש יראה פעם אחת אזהרת "אפליקציה לא מאומתת" ויאשר (ר' צעד 8).
>
> **רשימת Test users** כבר לא רלוונטית במצב In production, ואפשר להשאיר אותה כמו שהיא. ההגבלה על מי שנכנס למערכת נעשית בתוך המערכת עצמה (רשימת המורשים).

## צעד 6: פרטי ה-OAuth client (Clients)

1. לשונית **Clients**, או **APIs & Services → Credentials**.
2. **אם כבר קיים client מהגרסה הקודמת** (סוג Web application): פתחו אותו לעריכה.
   - תחת **Authorized redirect URIs** הוסיפו את:
     `https://ceter-engineers.vercel.app/api/auth/google/callback`
   - את הכתובת הישנה `.../api/google/callback` אפשר למחוק.
   - **Save**. ה-Client ID וה-Secret נשארים כמו שהיו, ואין צורך לשנות אותם ב-Vercel.
3. **אם אין client:** לחצו **Create client** (או **Create Credentials → OAuth client ID**):
   - **Application type:** Web application
   - **Name:** `כתר הנדסה – Vercel`
   - **Authorized JavaScript origins:** אפשר להשאיר ריק.
   - **Authorized redirect URIs:** `https://ceter-engineers.vercel.app/api/auth/google/callback`
   - **Create**.
   - **העתיקו מיד את ה-Client ID וה-Client secret**, או לחצו **Download JSON**. בקונסול החדש ה-secret מוצג רק פעם אחת.

> הכתובת חייבת להיות זהה בדיוק ל-`APP_URL` + `/api/auth/google/callback`: אותו https, בלי `/` בסוף ובלי www. אם תעברו בעתיד לדומיין אחר, צריך להוסיף גם אותו כאן.

## צעד 7: משתני סביבה ב-Vercel

ב-Vercel: **Project → Settings → Environment Variables**. ודאו שקיימים ארבעת המשתנים (בסביבת Production):

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | מצעד 6 |
| `GOOGLE_CLIENT_SECRET` | מצעד 6 |
| `APP_URL` | `https://ceter-engineers.vercel.app` (בלי `/` בסוף) |
| `TOKEN_ENCRYPTION_KEY` | **אם המשתנה כבר קיים, השאירו אותו כמו שהוא.** אם לא: 64 תווים הקסדצימליים אקראיים. מייצרים בטרמינל עם `openssl rand -hex 32`, או מבקשים מקלוד לייצר ערך ולהעביר אותו בפרטיות. לא לשמור בריפו. |

אחר כך: **Deployments → ⋮ ליד הפריסה האחרונה → Redeploy**, כדי שהשינויים ייכנסו לתוקף.

## צעד 8: כניסה ראשונה (כל שותף)

1. גלשו ל-https://ceter-engineers.vercel.app ולחצו **כניסה עם Google**.
2. בחרו את החשבון: `ronketerltd@gmail.com` או `guyketerltd@gmail.com`.
3. תופיע אזהרה: **"Google hasn't verified this app"**. לחצו **Advanced** ואז **Go to כתר הנדסה (unsafe)**. זה קורה פעם אחת.
4. מיד אחרי זה (בפעם הראשונה בלבד) יופיע מסך הרשאות ליומן. **ודאו שהתיבה של Google Calendar מסומנת**, ולחצו **Continue**.
5. הגעתם ללוח הבקרה. ב"הגדרות" אמור להופיע: "ההרשאה ליומן הראשי של ... פעילה".

`keterengineers@gmail.com` (מנהל המערכת) עובר רק את סעיפים 1–3. לא תוצג לו בקשת הרשאה ליומן.

---

## תקלות נפוצות

| מה רואים | הסיבה | פתרון |
|---|---|---|
| `Error 400: redirect_uri_mismatch` | ה-Redirect URI בקונסול לא תואם ל-`APP_URL` | צעד 6. ההודעה של גוגל מציגה את הכתובת המדויקת שנשלחה, והיא צריכה להופיע ברשימה בדיוק כך. |
| "לחשבון הזה אין הרשאת כניסה למערכת" | המייל לא נמצא ברשימת המורשים | לבדוק שנבחר החשבון הנכון. רשימת המורשים: ר' README. |
| "ההתחברות עם Google עוד לא הוגדרה בשרת" | חסר אחד מארבעת משתני הסביבה | צעד 7, ואחריו Redeploy. |
| ב"הגדרות": "ההרשאה ליומן לא סומנה" | בצעד 8.4 תיבת היומן לא סומנה | ב"הגדרות" לחצו "חיבור יומן Google" ואשרו שוב. |
| `Error 403: access_denied` ("has not completed the Google verification process") | האפליקציה עדיין במצב Testing | צעד 5. |
