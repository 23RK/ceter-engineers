import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartnerPicker } from "@/components/partner-picker";
import { Logo } from "@/components/logo";

export default async function ChooseUserPage() {
  await requireSession();

  const partners = await prisma.user.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size="lg" />
          <h1 className="text-lg font-bold text-brand-900">מי מתחבר?</h1>
          <p className="text-sm text-black/50">
            בחרו את השם שלכם כדי להמשיך
          </p>
        </div>

        {partners.length === 0 ? (
          <p className="text-center text-sm text-black/40">
            לא הוגדרו עדיין שותפים במערכת.
          </p>
        ) : (
          <PartnerPicker partners={partners} />
        )}
      </div>
    </main>
  );
}
