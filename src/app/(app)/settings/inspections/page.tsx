import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getInspectionSetup } from "@/lib/inspection-data";
import { InspectionSettings } from "@/components/settings/inspection-settings";

/** הגדרות בדק בית (SPEC §4.3): inspectors, property types, price list, rates, VAT. */
export default async function InspectionSettingsPage() {
  await requireUser();
  const setup = await getInspectionSetup();

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href="/settings"
        className="-mb-2 flex w-fit items-center gap-1 rounded-lg py-1 text-sm font-medium text-black/50 transition hover:text-brand-600"
      >
        <ChevronRight size={16} />
        הגדרות
      </Link>
      <div>
        <h1 className="text-xl font-bold text-brand-900">הגדרות בדק בית</h1>
        <p className="text-sm text-black/50">בודקים, סוגי נכס, מחירון, תעריפים ומע&quot;מ</p>
      </div>
      <InspectionSettings {...setup} />
    </div>
  );
}
