import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  await requirePartner();

  const credential = await prisma.credential.findFirst();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">הגדרות</h1>
        <p className="text-sm text-black/50">ניהול חשבון ההתחברות של החברה</p>
      </div>

      <SettingsForm currentEmail={credential?.email ?? ""} />
    </div>
  );
}
