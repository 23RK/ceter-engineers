"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { deleteFromTrash, emptyTrash, restoreFromTrash } from "@/lib/actions/undo";
import { useToast } from "@/components/ui/toast";

export type TrashRow = {
  id: string;
  kind: string;
  title: string;
  context: string | null;
  deletedBy: string | null;
  deletedAt: string;
  daysLeft: number;
};

export function TrashList({ rows }: { rows: TrashRow[] }) {
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const kinds = [...new Set(rows.map((r) => r.kind))];
  const visible = kind ? rows.filter((r) => r.kind === kind) : rows;

  const act = (id: string, fn: () => Promise<{ error?: string }>, done: string) => {
    setBusy(id);
    start(async () => {
      const res = await fn().catch(() => ({ error: "הפעולה נכשלה. נסו שוב." }));
      setBusy(null);
      if (res.error) toast.error(res.error);
      else {
        toast.info(done);
        router.refresh();
      }
    });
  };

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-black/5 bg-white p-8 text-center text-sm text-black/40 shadow-sm">
        סל המחזור ריק.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="min-h-10 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500"
          aria-label="סינון לפי סוג"
        >
          <option value="">הכל ({rows.length})</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k} ({rows.filter((r) => r.kind === k).length})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`למחוק סופית את כל ${rows.length} הפריטים בסל? אי אפשר לבטל את זה.`)) return;
            act("all", emptyTrash, "סל המחזור רוקן");
          }}
          className="min-h-10 rounded-lg px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          ריקון הסל
        </button>
      </div>

      <ul className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        {visible.map((r) => (
          <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${busy === r.id ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60">{r.kind}</span>
                <span className="font-medium text-brand-900">{r.title}</span>
                {r.context && <span className="text-xs text-black/40">· {r.context}</span>}
              </p>
              <p className="mt-0.5 text-xs text-black/40">
                נמחק <bdi dir="ltr">{r.deletedAt}</bdi>
                {r.deletedBy ? ` ע"י ${r.deletedBy}` : ""} · יימחק סופית בעוד {r.daysLeft} {r.daysLeft === 1 ? "יום" : "ימים"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act(r.id, () => restoreFromTrash(r.id), `"${r.title}" שוחזר`)}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-900 transition hover:bg-black/5 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                שחזור
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (!confirm(`למחוק סופית את "${r.title}"? אי אפשר לבטל את זה.`)) return;
                  act(r.id, () => deleteFromTrash(r.id), "נמחק סופית");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-black/30 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`מחיקה סופית של ${r.title}`}
                title="מחיקה סופית"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
