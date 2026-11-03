-- Undo and recycle bin (stage 5b). Additive only: two new tables, nothing
-- existing changes.

CREATE TABLE "UndoEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "label" TEXT NOT NULL,
    "ops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "UndoEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrashItem" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB NOT NULL,
    "deletedById" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UndoEntry_createdAt_idx" ON "UndoEntry"("createdAt");
CREATE INDEX "TrashItem_visible_deletedAt_idx" ON "TrashItem"("visible", "deletedAt");
CREATE INDEX "TrashItem_purgeAfter_idx" ON "TrashItem"("purgeAfter");
