"use client";

import { useActionState } from "react";
import { RefreshCw, Link2, Link2Off } from "lucide-react";
import {
  disconnectGoogleAction,
  syncFromGoogleAction,
  type ActionState,
} from "@/lib/actions/google";
import { formatDate } from "@/lib/format";
import type { UserOption } from "@/lib/types";

type ConnectionInfo = { googleEmail: string; lastSyncedAt: Date | null };

const initialState: ActionState = {};

export function GoogleConnectCard({
  partners,
  connections,
  currentPartnerId,
  googleConfigured,
}: {
  partners: UserOption[];
  connections: Record<string, ConnectionInfo>;
  currentPartnerId: string;
  googleConfigured: boolean;
}) {
  const [state, syncAction, syncPending] = useActionState(
    syncFromGoogleAction,
    initialState
  );

  if (!googleConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.015] p-5 text-sm text-black/40">
        חיבור ל-Google Calendar עדיין לא הוגדר עבור המערכת. זה נדרש בשלב
        הגדרה חד-פעמי (ראו README).
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-brand-900">
          סנכרון Google Calendar
        </h2>
        <form action={syncAction}>
          <button
            type="submit"
            disabled={syncPending}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-900 transition hover:bg-black/5 disabled:opacity-60"
          >
            <RefreshCw size={12} className={syncPending ? "animate-spin" : ""} />
            רענון מיומן Google
          </button>
        </form>
      </div>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {partners.map((partner) => {
          const connection = connections[partner.id];
          const isMe = partner.id === currentPartnerId;

          return (
            <div
              key={partner.id}
              className="flex items-center justify-between rounded-xl border border-black/5 p-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: partner.color }}
                >
                  {partner.name.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-medium text-brand-900">
                    {partner.name}
                  </p>
                  {connection ? (
                    <p className="text-xs text-black/40" dir="ltr">
                      {connection.googleEmail}
                    </p>
                  ) : (
                    <p className="text-xs text-black/35">לא מחובר</p>
                  )}
                </div>
              </div>

              {connection ? (
                isMe ? (
                  <form action={disconnectGoogleAction}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Link2Off size={12} />
                      ניתוק
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-black/30">
                    {connection.lastSyncedAt
                      ? `סונכרן ${formatDate(connection.lastSyncedAt)}`
                      : ""}
                  </span>
                )
              ) : isMe ? (
                <a
                  href="/api/google/connect"
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  <Link2 size={12} />
                  חיבור
                </a>
              ) : (
                <span className="text-xs text-black/25">
                  רק {partner.name} יכול/ה לחבר בעצמו/ה
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
