-- Stage 1, part 1: per-user "Sign in with Google".
-- Adds email + role to User. The User rows themselves (and therefore every
-- task / meeting / activity already linked to them) are kept as-is - we only
-- attach the partners' Google emails to the existing profiles.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT,
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PARTNER';

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Link the existing partner profiles to their Google emails. The seed
-- created them with fixed ids; fall back to matching by name in case a
-- profile was created some other way.
UPDATE "User" SET "email" = 'ronketerltd@gmail.com' WHERE "id" = 'partner-ron';
UPDATE "User" SET "email" = 'guyketerltd@gmail.com' WHERE "id" = 'partner-guy';

UPDATE "User" SET "email" = 'ronketerltd@gmail.com'
WHERE "id" = (SELECT "id" FROM "User" WHERE "name" = 'רון' AND "email" IS NULL ORDER BY "createdAt" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'ronketerltd@gmail.com');

UPDATE "User" SET "email" = 'guyketerltd@gmail.com'
WHERE "id" = (SELECT "id" FROM "User" WHERE "name" = 'גיא' AND "email" IS NULL ORDER BY "createdAt" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'guyketerltd@gmail.com');

-- The company mailbox stays on as system admin.
INSERT INTO "User" ("id", "name", "email", "role", "color", "createdAt")
VALUES ('admin-keter', 'מנהל מערכת', 'keterengineers@gmail.com', 'ADMIN', '#64748b', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Calendar sync moves to each partner's primary calendar (decision 1 in
-- docs/SPEC.md). The old dedicated calendar is left untouched in Google.
ALTER TABLE "GoogleAccount" ALTER COLUMN "calendarId" SET DEFAULT 'primary';
UPDATE "GoogleAccount" SET "calendarId" = 'primary';
