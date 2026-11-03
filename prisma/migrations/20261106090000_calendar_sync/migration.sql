-- Two-way Google Calendar sync (SPEC §2.2, stage 5a). Additive only: new
-- nullable / defaulted columns and indexes. The one data change: existing
-- meetings get their creator as owner (ownerId was empty until now).
-- MeetingGoogleSync is no longer used, but is NOT dropped here (needs approval).

-- Meeting
ALTER TABLE "Meeting" ADD COLUMN "ownerId" TEXT,
ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "googleKey" TEXT,
ADD COLUMN "googleUpdated" TIMESTAMP(3),
ADD COLUMN "fromGoogle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "withPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleSyncPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleSyncError" TEXT;

UPDATE "Meeting" SET "ownerId" = "createdById" WHERE "ownerId" IS NULL;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Meeting_googleKey_key" ON "Meeting"("googleKey");
CREATE UNIQUE INDEX "Meeting_ownerId_googleEventId_key" ON "Meeting"("ownerId", "googleEventId");
CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");

-- GoogleAccount
ALTER TABLE "GoogleAccount" ADD COLUMN "syncToken" TEXT,
ADD COLUMN "lastFullSyncAt" TIMESTAMP(3),
ADD COLUMN "syncError" TEXT,
ADD COLUMN "syncLockedUntil" TIMESTAMP(3),
ADD COLUMN "syncAgain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "channelId" TEXT,
ADD COLUMN "channelResourceId" TEXT,
ADD COLUMN "channelToken" TEXT,
ADD COLUMN "channelExpiresAt" TIMESTAMP(3);

-- Inspection
ALTER TABLE "Inspection" ADD COLUMN "googleEventUserId" TEXT,
ADD COLUMN "googleEventHash" TEXT,
ADD COLUMN "googleSyncPending" BOOLEAN NOT NULL DEFAULT false;
