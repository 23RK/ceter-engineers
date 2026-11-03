-- Stage 3: בדק בית (SPEC §4). Additive only: new enums and new tables, plus
-- their starting data. No existing table or row is changed.
--   * Inspector, ApartmentType, PriceTier (מחירון - left empty, filled in
--     Settings), InspectorRate, AppSetting, Inspection.
--   * Starting data (SPEC §4.2): inspectors רון and גיא (owners, linked to
--     their users by email when those exist), לירן, אבי, עוז הנדסה
--     (freelancers); the 10 property types; the inspector rates from the
--     spreadsheet (without VAT); VAT rate 18%.

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('OWNER', 'FREELANCER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('REGULAR', 'REPEAT');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING_SCHEDULING', 'SCHEDULED', 'DONE', 'REPORT_SENT', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InspectionPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'BIT', 'PAYBOX', 'CHECK', 'CASH', 'CREDIT');

-- CreateTable
CREATE TABLE "Inspector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FREELANCER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Inspector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApartmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApartmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "minUnits" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apartmentTypeId" TEXT NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectorRate" (
    "id" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "multiUnitRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT NOT NULL,
    "apartmentTypeId" TEXT,

    CONSTRAINT "InspectorRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "time" TEXT,
    "kind" "InspectionKind" NOT NULL DEFAULT 'REGULAR',
    "unitsCount" INTEGER NOT NULL DEFAULT 1,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING_SCHEDULING',
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "city" TEXT,
    "address" TEXT,
    "apartmentNumber" TEXT,
    "developerContractor" TEXT,
    "price" DOUBLE PRECISION,
    "paymentStatus" "InspectionPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "reportSent" BOOLEAN NOT NULL DEFAULT false,
    "reportSentAt" TIMESTAMP(3),
    "inspectorPay" DOUBLE PRECISION,
    "inspectorPaid" BOOLEAN NOT NULL DEFAULT false,
    "inspectorPaidAt" TIMESTAMP(3),
    "notes" TEXT,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inspectorId" TEXT,
    "apartmentTypeId" TEXT,
    "parentInspectionId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inspector_userId_key" ON "Inspector"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_apartmentTypeId_minUnits_key" ON "PriceTier"("apartmentTypeId", "minUnits");

-- CreateIndex
CREATE INDEX "InspectorRate_inspectorId_idx" ON "InspectorRate"("inspectorId");

-- CreateIndex
CREATE INDEX "Inspection_date_idx" ON "Inspection"("date");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_date_idx" ON "Inspection"("inspectorId", "date");

-- CreateIndex
CREATE INDEX "Inspection_clientPhone_idx" ON "Inspection"("clientPhone");

-- CreateIndex
CREATE INDEX "Inspection_parentInspectionId_idx" ON "Inspection"("parentInspectionId");

-- AddForeignKey
ALTER TABLE "Inspector" ADD CONSTRAINT "Inspector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_apartmentTypeId_fkey" FOREIGN KEY ("apartmentTypeId") REFERENCES "ApartmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectorRate" ADD CONSTRAINT "InspectorRate_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectorRate" ADD CONSTRAINT "InspectorRate_apartmentTypeId_fkey" FOREIGN KEY ("apartmentTypeId") REFERENCES "ApartmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Inspector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_apartmentTypeId_fkey" FOREIGN KEY ("apartmentTypeId") REFERENCES "ApartmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_parentInspectionId_fkey" FOREIGN KEY ("parentInspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Starting data

INSERT INTO "Inspector" ("id", "name", "color", "active", "employmentType", "userId") VALUES
  ('inspector-ron', 'רון', COALESCE((SELECT "color" FROM "User" WHERE "email" = 'ronketerltd@gmail.com'), '#2251e0'), true, 'OWNER',
     (SELECT "id" FROM "User" WHERE "email" = 'ronketerltd@gmail.com')),
  ('inspector-guy', 'גיא', COALESCE((SELECT "color" FROM "User" WHERE "email" = 'guyketerltd@gmail.com'), '#eda520'), true, 'OWNER',
     (SELECT "id" FROM "User" WHERE "email" = 'guyketerltd@gmail.com')),
  ('inspector-liran', 'לירן', '#0891b2', true, 'FREELANCER', NULL),
  ('inspector-avi', 'אבי', '#c026d3', true, 'FREELANCER', NULL),
  ('inspector-oz', 'עוז הנדסה', '#65a30d', true, 'FREELANCER', NULL);

INSERT INTO "ApartmentType" ("id", "name", "order") VALUES
  ('apt-2', '2 חדרים', 0),
  ('apt-3', '3 חדרים', 1),
  ('apt-4', '4 חדרים', 2),
  ('apt-5', '5 חדרים', 3),
  ('apt-6plus', '6 חדרים ומעלה', 4),
  ('apt-garden', 'דירת גן', 5),
  ('apt-penthouse', 'פנטהאוז', 6),
  ('apt-duplex', 'דופלקס', 7),
  ('apt-house', 'בית פרטי', 8),
  ('apt-other', 'אחר', 9);

-- Rates without VAT. A row without a property type applies to every type
-- that has no row of its own. "–" in the spreadsheet = no row (the pay is
-- then entered by hand, or the regular rate applies - see src/lib/inspections.ts).
INSERT INTO "InspectorRate" ("id", "inspectorId", "apartmentTypeId", "kind", "rate", "multiUnitRate") VALUES
  ('rate-liran-regular', 'inspector-liran', NULL, 'REGULAR', 585, 526.5),
  ('rate-liran-6plus', 'inspector-liran', 'apt-6plus', 'REGULAR', 702, NULL),
  ('rate-liran-garden', 'inspector-liran', 'apt-garden', 'REGULAR', 702, NULL),
  ('rate-liran-repeat', 'inspector-liran', NULL, 'REPEAT', 468, NULL),
  ('rate-avi-regular', 'inspector-avi', NULL, 'REGULAR', 550, 500),
  ('rate-avi-repeat', 'inspector-avi', NULL, 'REPEAT', 450, NULL),
  ('rate-oz-regular', 'inspector-oz', NULL, 'REGULAR', 650, 600);

INSERT INTO "AppSetting" ("key", "value") VALUES ('vatRate', '18')
  ON CONFLICT ("key") DO NOTHING;
