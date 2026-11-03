-- Retainer fees: the billing day in the month and the payment terms, separate
-- from the period's start date. Additive only: two nullable columns; existing
-- projects keep the previous behavior (billing on the start date's day, due
-- immediately) while these stay empty.
ALTER TABLE "Project" ADD COLUMN "feeBillingDay" INTEGER,
ADD COLUMN "feePaymentTermsDays" INTEGER;
