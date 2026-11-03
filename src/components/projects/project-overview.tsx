import {
  AlertTriangle,
  CircleAlert,
  ClipboardList,
  Flag,
  ListChecks,
  MessageSquareText,
  UserX,
  Wallet,
} from "lucide-react";
import type { StageStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { TabLink } from "@/components/projects/project-tabs";
import { currentStage, sortStages } from "@/lib/stages";
import { paymentsDueForDoneStages } from "@/lib/fees";
import { formatDateShort, formatMoney, israelToday } from "@/lib/format";

type Stage = { id: string; title: string; status: StageStatus; order: number; createdAt: Date; dueDate: Date | null };
type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignee: { name: string; color: string } | null;
};
type Payment = { id: string; title: string | null; amount: number; paid: boolean; dueDate: Date | null; stageId: string | null };

const DAY = 24 * 60 * 60 * 1000;
const daysLate = (d: Date) => Math.round((israelToday().getTime() - new Date(d).getTime()) / DAY);
const isLate = (d: Date | null) => !!d && new Date(d).getTime() < israelToday().getTime();

type Urgent = { key: string; tab: string; icon: React.ReactNode; text: React.ReactNode };

/** סקירה (SPEC §3.4): what's urgent, the latest update, the next stage, open tasks. */
export function ProjectOverview({
  stages,
  tasks,
  payments,
  latestUpdate,
  unsentReports,
  pendingChanges,
}: {
  stages: Stage[];
  tasks: Task[];
  payments: Payment[];
  latestUpdate: { body: string; createdAt: Date; author: string | null; fileCount: number } | null;
  /** יזמים: supervision reports not sent yet (null for other departments). */
  unsentReports: number | null;
  /** וילות: changes waiting for the client's approval. */
  pendingChanges: number | null;
}) {
  const open = tasks
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const sorted = sortStages(stages);
  const current = currentStage(sorted);
  const after = current ? sorted.slice(sorted.indexOf(current) + 1).find((s) => s.status !== "DONE") : null;

  const urgent: Urgent[] = [];
  for (const t of open.filter((t) => isLate(t.dueDate))) {
    const days = daysLate(t.dueDate!);
    urgent.push({
      key: `late-${t.id}`,
      tab: "tasks",
      icon: <ListChecks size={15} className="text-red-500" />,
      text: (
        <>
          משימה באיחור: <b>{t.title}</b>{" "}
          <span className="text-red-600">({days === 1 ? "יום אחד" : `${days} ימים`})</span>
        </>
      ),
    });
  }
  for (const t of open.filter((t) => t.priority === "URGENT" && !isLate(t.dueDate))) {
    urgent.push({
      key: `urgent-${t.id}`,
      tab: "tasks",
      icon: <CircleAlert size={15} className="text-red-500" />,
      text: (
        <>
          משימה דחופה: <b>{t.title}</b>
        </>
      ),
    });
  }
  const lateStage = sorted.find((s) => s.status !== "DONE" && isLate(s.dueDate));
  if (lateStage) {
    urgent.push({
      key: "stage",
      tab: "stages",
      icon: <Flag size={15} className="text-red-500" />,
      text: (
        <>
          שלב שעבר את התאריך המתוכנן: <b>{lateStage.title}</b> ({formatDateShort(lateStage.dueDate)})
        </>
      ),
    });
  }
  for (const p of paymentsDueForDoneStages(payments, stages)) {
    urgent.push({
      key: `pay-stage-${p.id}`,
      tab: "finance",
      icon: <Wallet size={15} className="text-amber-600" />,
      text: (
        <>
          שלב הושלם ותשלום לא נגבה: <b>{p.title ?? "תשלום"}</b> ({formatMoney(p.amount)})
        </>
      ),
    });
  }
  const latePayments = payments.filter((p) => !p.paid && isLate(p.dueDate));
  if (latePayments.length > 0) {
    urgent.push({
      key: "pay-late",
      tab: "finance",
      icon: <Wallet size={15} className="text-red-500" />,
      text: (
        <>
          {latePayments.length === 1 ? "תשלום אחד עבר" : `${latePayments.length} תשלומים עברו`} את תאריך היעד (
          {formatMoney(latePayments.reduce((s, p) => s + p.amount, 0))})
        </>
      ),
    });
  }
  const unassigned = open.filter((t) => !t.assignee).length;
  if (unassigned > 0) {
    urgent.push({
      key: "unassigned",
      tab: "tasks",
      icon: <UserX size={15} className="text-amber-600" />,
      text: <>{unassigned === 1 ? "משימה אחת ללא שיוך" : `${unassigned} משימות ללא שיוך`}</>,
    });
  }
  if (unsentReports) {
    urgent.push({
      key: "reports",
      tab: "reports",
      icon: <ClipboardList size={15} className="text-amber-600" />,
      text: <>{unsentReports === 1 ? "דוח פיקוח אחד לא נשלח" : `${unsentReports} דוחות פיקוח לא נשלחו`}</>,
    });
  }
  if (pendingChanges) {
    urgent.push({
      key: "changes",
      tab: "changes",
      icon: <ClipboardList size={15} className="text-amber-600" />,
      text: <>{pendingChanges === 1 ? "שינוי אחד ממתין לאישור הלקוח" : `${pendingChanges} שינויים ממתינים לאישור הלקוח`}</>,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="מה דחוף" icon={<AlertTriangle size={16} className="text-red-500" />} className="lg:col-span-2">
        {urgent.length === 0 ? (
          <p className="text-sm text-black/45">אין כרגע משהו דחוף.</p>
        ) : (
          <ul className="flex flex-col">
            {urgent.slice(0, 10).map((u) => (
              <li key={u.key}>
                <TabLink
                  tab={u.tab}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-right text-sm text-brand-900 transition hover:bg-black/[0.03]"
                >
                  <span className="shrink-0">{u.icon}</span>
                  <span className="min-w-0">{u.text}</span>
                </TabLink>
              </li>
            ))}
            {urgent.length > 10 && <li className="px-2 pt-1 text-xs text-black/45">ועוד {urgent.length - 10}</li>}
          </ul>
        )}
      </Card>

      <Card title="העדכון האחרון" icon={<MessageSquareText size={16} className="text-brand-600" />} link={{ tab: "updates", label: "לכל העדכונים" }}>
        {latestUpdate ? (
          <div>
            <p className="line-clamp-4 whitespace-pre-line text-sm text-brand-900">
              {latestUpdate.body || (latestUpdate.fileCount ? "צורפו קבצים" : "")}
            </p>
            <p className="mt-2 text-xs text-black/45">
              {latestUpdate.author ?? "—"} · {formatDateShort(latestUpdate.createdAt)}
              {latestUpdate.fileCount > 0 && ` · ${latestUpdate.fileCount} קבצים מצורפים`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-black/45">אין עדיין עדכונים.</p>
        )}
      </Card>

      <Card title="השלב הבא" icon={<Flag size={16} className="text-brand-600" />} link={{ tab: "stages", label: "לכל השלבים" }}>
        {sorted.length === 0 ? (
          <p className="text-sm text-black/45">אין עדיין שלבים בפרויקט.</p>
        ) : !current ? (
          <p className="text-sm font-medium text-green-700">כל השלבים הושלמו.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-black/45">עכשיו</dt>
            <dd className="font-semibold text-brand-900">
              {current.title}
              {current.dueDate && (
                <span className={`mr-2 text-xs font-normal ${isLate(current.dueDate) ? "text-red-600" : "text-black/45"}`}>
                  מתוכנן ל-{formatDateShort(current.dueDate)}
                </span>
              )}
            </dd>
            <dt className="text-black/45">אחריו</dt>
            <dd className="text-brand-900">
              {after ? (
                <>
                  {after.title}
                  {after.dueDate && <span className="mr-2 text-xs text-black/45">{formatDateShort(after.dueDate)}</span>}
                </>
              ) : (
                <span className="text-black/45">זה השלב האחרון</span>
              )}
            </dd>
          </dl>
        )}
      </Card>

      <Card
        title={`משימות פתוחות (${open.length})`}
        icon={<ListChecks size={16} className="text-brand-600" />}
        link={{ tab: "tasks", label: "לכל המשימות" }}
        className="lg:col-span-2"
      >
        {open.length === 0 ? (
          <p className="text-sm text-black/45">אין משימות פתוחות.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {open.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-brand-900">{t.title}</span>
                {t.assignee ? (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: t.assignee.color }}
                    title={t.assignee.name}
                  >
                    {t.assignee.name.slice(0, 1)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-amber-700">ללא שיוך</span>
                )}
                <span className={`w-16 shrink-0 text-left text-xs ${isLate(t.dueDate) ? "font-semibold text-red-600" : "text-black/45"}`}>
                  {formatDateShort(t.dueDate) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  icon,
  link,
  className = "",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  link?: { tab: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-brand-900">
          {icon}
          {title}
        </h2>
        {link && (
          <TabLink tab={link.tab} className="text-xs font-medium text-brand-600 hover:underline">
            {link.label}
          </TabLink>
        )}
      </div>
      {children}
    </section>
  );
}
