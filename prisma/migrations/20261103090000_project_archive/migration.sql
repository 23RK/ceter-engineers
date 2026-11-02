-- Stage 2 part B2: the department screen's archive (SPEC §3.2).
-- Additive only. A project is in the archive when it was moved there by hand
-- (archivedAt is set) or its status is הושלם / בוטל - that part is computed in
-- the app, so no existing row changes here.
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");
