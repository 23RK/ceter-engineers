import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead, openNotification } from "@/lib/actions/updates";

const timeFormat = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** The signed-in partner's notifications (e.g. tagged in a project update). */
export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      message: true,
      readAt: true,
      createdAt: true,
      update: { select: { body: true } },
    },
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">התראות</h1>
          <p className="text-sm text-black/50">
            {unread === 0 ? "אין התראות חדשות" : unread === 1 ? "התראה חדשה אחת" : `${unread} התראות חדשות`}
          </p>
        </div>
        {unread > 0 && (
          <form action={async () => { "use server"; await markAllNotificationsRead(); }}>
            <button className="min-h-10 rounded-lg border border-black/10 px-3.5 text-sm font-medium text-brand-900 hover:bg-black/5">
              סימון הכל כנקרא
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          <Bell size={22} />
          כשתתויגו בעדכון של פרויקט, ההתראה תופיע כאן.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotification.bind(null, n.id)}>
                <button
                  className={`flex w-full flex-col gap-1 rounded-2xl border p-4 text-right shadow-sm transition hover:shadow-md ${
                    n.readAt ? "border-black/5 bg-white" : "border-brand-200 bg-brand-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${n.readAt ? "text-brand-900" : "font-bold text-brand-900"}`}>
                      {n.message}
                    </span>
                    <span className="shrink-0 text-xs text-black/40">{timeFormat.format(n.createdAt)}</span>
                  </span>
                  {n.update?.body && (
                    <span className="line-clamp-2 text-xs text-black/55">{n.update.body}</span>
                  )}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
