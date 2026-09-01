import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { LeadCard } from "@/components/business-dev/lead-card";
import { NewLeadButton } from "@/components/business-dev/new-lead-button";

export default async function BusinessDevPage() {
  await requirePartner();

  const leads = await prisma.lead.findMany({
    include: {
      tasks: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">פיתוח עסקי</h1>
          <p className="text-sm text-black/50">
            מעקב אחר הזדמנויות ולידים להבאת פרויקטים חדשים
          </p>
        </div>
        <NewLeadButton />
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          עדיין אין הזדמנויות. לחצו על &quot;הזדמנות חדשה&quot; כדי להתחיל.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => {
            const totalTasks = lead.tasks.length;
            const openTasks = lead.tasks.filter(
              (t) => t.status !== "DONE"
            ).length;
            return (
              <LeadCard
                key={lead.id}
                lead={lead}
                totalTasks={totalTasks}
                openTasks={openTasks}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
