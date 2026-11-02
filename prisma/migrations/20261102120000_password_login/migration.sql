-- Stage 1, part 1 (revised): personal email + password sign-in; Google OAuth
-- is used only to connect each partner's own calendar.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Wipe every Google connection made under the old system (tokens and the
-- meeting <-> Google event links), so nothing keeps syncing from accounts
-- other than the two partner accounts. Each partner reconnects from
-- Settings. Meetings themselves are kept.
DELETE FROM "MeetingGoogleSync";
DELETE FROM "GoogleAccount";

-- Hard guarantee at the database level: only these two Google accounts can
-- ever have stored calendar tokens. (Prisma doesn't model CHECK
-- constraints; it lives only here.)
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_googleEmail_allowed"
  CHECK ("googleEmail" IN ('ronketerltd@gmail.com', 'guyketerltd@gmail.com'));

-- The shared company login ("Credential") is cancelled: the app no longer
-- reads it. The table itself is dropped in a later migration.
