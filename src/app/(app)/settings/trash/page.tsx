import Link from "next/link";
import { after } from "next/server";
import { ChevronRight, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import { purgeExpired } from "@/lib/undo/undo";
import { daysUntil, TRASH_DAYS } from "@/lib/undo/models";
import { israelDayKey, israelTime } from "@/lib/israel-time";
import { TrashList, type TrashRow } from "@/components/settings/trash-list";

// סל מחזור (stage 5b): everything deleted in the last 30 days, with
// "שחזור" and "מחיקה סופית".

export default async function TrashPage() {
  await requireUser();
  after(() => purgeExpired().catch(() => {}));

  const [items, users] = await Promise.all([
    basePrisma.trashItem.findMany({
      where: { visible: true, purgeAfter: { gt: new Date() } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, kind: true, title: true, context: true, deletedById: true, deletedAt: true, purgeAfter: true },
      take: 500,
    }),
    basePrisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const rows: TrashRow[] = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    context: i.context,
    deletedBy: users.find((u) => u.id === i.deletedById)?.name ?? null,
    deletedAt: `${israelDayKey(i.deletedAt).split("-").reverse().join("/")} ${israelTime(i.deletedAt)}`,
    daysLeft: daysUntil(i.purgeAfter),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/settings" className="mb-2 inline-flex items-center gap-1 text-xs text-black/40 hover:text-brand-600">
          <ChevronRight size={14} />
          הגדרות
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-900">
          <Trash2 size={20} />
          סל מחזור
        </h1>
        <p className="text-sm text-black/50">
          מה שנמחק נשמר כאן {TRASH_DAYS} יום, ואז נמחק סופית. שחזור מחזיר את הפריט בדיוק כמו שהיה, עם כל מה שנמחק איתו
          (למשל פרויקט עם המשימות, השלבים והמסמכים שלו).
        </p>
      </div>
      <TrashList rows={rows} />
    </div>
  );
}
