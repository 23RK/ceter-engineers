-- CreateEnum
CREATE TYPE "GoogleSyncStatus" AS ENUM ('SYNCED', 'ERROR');

-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingGoogleSync" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "googleUpdated" TIMESTAMP(3),
    "status" "GoogleSyncStatus" NOT NULL DEFAULT 'SYNCED',

    CONSTRAINT "MeetingGoogleSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingGoogleSync_meetingId_userId_key" ON "MeetingGoogleSync"("meetingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingGoogleSync_userId_googleEventId_key" ON "MeetingGoogleSync"("userId", "googleEventId");

-- AddForeignKey
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingGoogleSync" ADD CONSTRAINT "MeetingGoogleSync_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingGoogleSync" ADD CONSTRAINT "MeetingGoogleSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

