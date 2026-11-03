import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StageTemplatesEditor } from "@/components/settings/stage-templates-editor";

export default async function StageTemplatesPage() {
  await requireUser();
  const templates = await prisma.stageTemplate.findMany({
    select: { id: true, department: true, title: true, order: true, createdAt: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/settings"
        className="-mb-2 flex w-fit items-center gap-1 rounded-lg py-1 text-sm font-medium text-black/50 transition hover:text-brand-600"
      >
        <ChevronRight size={16} />
        הגדרות
      </Link>
      <div>
        <h1 className="text-xl font-bold text-brand-900">תבניות שלבים</h1>
        <p className="text-sm text-black/50">
          פרויקט חדש נוצר עם שלבי התבנית של המחלקה שלו. שינוי בתבנית חל על
          פרויקטים חדשים בלבד, ולא משנה פרויקטים קיימים.
        </p>
      </div>
      <StageTemplatesEditor templates={templates} />
    </div>
  );
}
