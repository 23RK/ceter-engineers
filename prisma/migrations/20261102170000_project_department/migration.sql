-- Stage 2 part A: a department for each project (SPEC §3.1).
-- ADDITIVE ONLY: Preview and Production currently share one database, and
-- this runs on every build. Nothing is dropped or rewritten.

CREATE TYPE "Department" AS ENUM ('DEVELOPER', 'VILLA');

ALTER TABLE "Project" ADD COLUMN "department" "Department";

CREATE INDEX "Project_department_idx" ON "Project"("department");

-- Auto-assign only when the name is unambiguous: it mentions villas or
-- developers, but not both. Everything else stays NULL and is listed on the
-- "שיוך מחלקות" screen for manual assignment. Must match STRONG_RULES in
-- src/lib/departments.ts.
UPDATE "Project" SET "department" = 'VILLA'
WHERE "department" IS NULL
  AND ("name" LIKE '%וילה%' OR "name" LIKE '%ווילה%' OR "name" LIKE '%וילות%' OR "name" LIKE '%ווילות%')
  AND NOT ("name" LIKE '%יזם%' OR "name" LIKE '%יזמ%');

UPDATE "Project" SET "department" = 'DEVELOPER'
WHERE "department" IS NULL
  AND ("name" LIKE '%יזם%' OR "name" LIKE '%יזמ%')
  AND NOT ("name" LIKE '%וילה%' OR "name" LIKE '%ווילה%' OR "name" LIKE '%וילות%' OR "name" LIKE '%ווילות%');
