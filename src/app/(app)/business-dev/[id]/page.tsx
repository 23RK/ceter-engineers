import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { LeadHeader } from "@/components/business-dev/lead-header";
import { LeadTaskList } from "@/components/business-dev/lead-task-list";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePartner();
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { order: "asc" } },
    },
  });

  if (!lead) notFound();

  return (
    <div className="flex flex-col gap-5">
      <LeadHeader lead={lead} />
      <LeadTaskList leadId={lead.id} tasks={lead.tasks} />
    </div>
  );
}
