-- No system admin for now: only רון and גיא may sign in. Removes the
-- keterengineers@gmail.com user added by 20261101120000_google_sign_in.
-- (A separate migration, not an edit of that one, because a Vercel preview
-- build of the branch may already have applied it to the shared database.)
-- The account stays owner of the Google Cloud project and will send the
-- daily summary email, but it doesn't sign in to the app.

-- Off the allow-list first - a user without an email can't sign in.
UPDATE "User" SET "email" = NULL WHERE "email" = 'keterengineers@gmail.com';

-- Then delete the row itself, unless it somehow already owns data (in which
-- case it stays as an email-less profile so nothing linked to it breaks).
DELETE FROM "User" u
WHERE u."id" = 'admin-keter'
  AND NOT EXISTS (SELECT 1 FROM "Task" WHERE "createdById" = u."id" OR "assigneeId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Meeting" WHERE "createdById" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Activity" WHERE "actorId" = u."id");
