import Link from "next/link";
import { Bell } from "lucide-react";

/** Unread notifications (e.g. tagged in a project update) - links to /notifications. */
export function NotificationBell({ count, dark = true }: { count: number; dark?: boolean }) {
  return (
    <Link
      href="/notifications"
      aria-label={count ? `התראות: ${count} חדשות` : "התראות"}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${
        dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-black/60 hover:bg-black/5"
      }`}
    >
      <Bell size={19} />
      {count > 0 && (
        <span className="absolute top-1 left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
