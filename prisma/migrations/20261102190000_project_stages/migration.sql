-- Stage 2 part B1: project stages + editable stage templates (SPEC §3.3),
-- and a project owner (אחראי) + city.
-- ADDITIVE ONLY: Preview and Production currently share one database, and
-- this runs on every build. Nothing is dropped; existing milestones are kept
-- as stages, and the `done` column stays (kept in sync by the app).

CREATE TYPE "StageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- Stages: status + actual date. dueDate stays as the planned date.
ALTER TABLE "Milestone" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "status" "StageStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- Existing completed milestones become completed stages. Their actual date
-- is unknown, so completedAt stays empty.
UPDATE "Milestone" SET "status" = 'DONE' WHERE "done" = true;

CREATE INDEX "Milestone_projectId_order_idx" ON "Milestone"("projectId", "order");

-- Project owner (רון / גיא) and city.
ALTER TABLE "Project" ADD COLUMN "city" TEXT,
ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- City from the address, only when it clearly has one: the part after the
-- last comma (e.g. "רח' הרצל 12, ראשון לציון" -> "ראשון לציון"). The address
-- itself is not changed.
UPDATE "Project"
SET "city" = btrim(regexp_replace("address", '^.*,', ''))
WHERE "city" IS NULL
  AND "address" LIKE '%,%'
  AND btrim(regexp_replace("address", '^.*,', '')) <> '';

-- Stage templates, editable in Settings. New projects copy their
-- department's template.
CREATE TABLE "StageTemplate" (
    "id" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageTemplate_department_order_idx" ON "StageTemplate"("department", "order");

-- Default templates, exactly as in SPEC §3.3.
INSERT INTO "StageTemplate" ("id", "department", "title", "order") VALUES
  (gen_random_uuid()::text, 'DEVELOPER', 'ליווי תכנון ותיאום יועצים', 0),
  (gen_random_uuid()::text, 'DEVELOPER', 'היתר בנייה', 1),
  (gen_random_uuid()::text, 'DEVELOPER', 'מכרז ובחירת קבלן מבצע', 2),
  (gen_random_uuid()::text, 'DEVELOPER', 'חוזה קבלן והתארגנות', 3),
  (gen_random_uuid()::text, 'DEVELOPER', 'צו התחלת עבודה', 4),
  (gen_random_uuid()::text, 'DEVELOPER', 'חפירה ודיפון', 5),
  (gen_random_uuid()::text, 'DEVELOPER', 'יסודות', 6),
  (gen_random_uuid()::text, 'DEVELOPER', 'שלד – מרתפים', 7),
  (gen_random_uuid()::text, 'DEVELOPER', 'שלד – קומות וגג', 8),
  (gen_random_uuid()::text, 'DEVELOPER', 'מעטפת, איטום וחלונות', 9),
  (gen_random_uuid()::text, 'DEVELOPER', 'מערכות (חשמל, אינסטלציה, מיזוג, מעליות, כיבוי אש)', 10),
  (gen_random_uuid()::text, 'DEVELOPER', 'גמרים', 11),
  (gen_random_uuid()::text, 'DEVELOPER', 'פיתוח שטח', 12),
  (gen_random_uuid()::text, 'DEVELOPER', 'טופס 4 / תעודת גמר', 13),
  (gen_random_uuid()::text, 'DEVELOPER', 'מסירות לדיירים', 14),
  (gen_random_uuid()::text, 'DEVELOPER', 'שנת בדק ואחריות', 15);

INSERT INTO "StageTemplate" ("id", "department", "title", "order") VALUES
  (gen_random_uuid()::text, 'VILLA', 'ליווי תכנון ותקציב', 0),
  (gen_random_uuid()::text, 'VILLA', 'היתר בנייה', 1),
  (gen_random_uuid()::text, 'VILLA', 'בחירת קבלן וחוזה', 2),
  (gen_random_uuid()::text, 'VILLA', 'התחלת עבודה וחפירה', 3),
  (gen_random_uuid()::text, 'VILLA', 'יסודות', 4),
  (gen_random_uuid()::text, 'VILLA', 'שלד', 5),
  (gen_random_uuid()::text, 'VILLA', 'גג ואיטום', 6),
  (gen_random_uuid()::text, 'VILLA', 'מערכות (חשמל, אינסטלציה, מיזוג)', 7),
  (gen_random_uuid()::text, 'VILLA', 'טיח, חלונות ומעטפת', 8),
  (gen_random_uuid()::text, 'VILLA', 'גמרים (ריצוף, חיפוי, נגרות, מטבח)', 9),
  (gen_random_uuid()::text, 'VILLA', 'פיתוח וגינון', 10),
  (gen_random_uuid()::text, 'VILLA', 'טופס 4 וחיבורי תשתית', 11),
  (gen_random_uuid()::text, 'VILLA', 'מסירה ורשימת ליקויים', 12),
  (gen_random_uuid()::text, 'VILLA', 'שנת בדק ואחריות', 13);
