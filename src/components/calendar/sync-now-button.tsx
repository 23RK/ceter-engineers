"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncCalendarsNow } from "@/lib/actions/meetings";

/** "סנכרון עכשיו": reads both Google calendars right away. */
export function SyncNowButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await syncCalendarsNow();
          if (res.error) alert(res.error);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-black/60 transition hover:bg-black/5 disabled:opacity-60"
    >
      <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
      {pending ? "מסנכרן..." : "סנכרון עכשיו"}
    </button>
  );
}
