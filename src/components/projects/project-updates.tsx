"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AtSign, Paperclip, Send, Trash2 } from "lucide-react";
import { createUpdate, deleteUpdate } from "@/lib/actions/updates";
import type { ActionState } from "@/lib/actions/tasks";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/form-values";
import { FileChip, type FileInfo } from "@/components/projects/project-documents";
import type { UserOption } from "@/lib/types";
import { useActionResult, useUndoToast } from "@/components/ui/toast";

export type UpdateInfo = {
  id: string;
  body: string;
  createdAt: Date;
  author: UserOption | null;
  files: FileInfo[];
  tagged: string[];
};

const timeFormat = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** עדכונים (SPEC §3.4): a thread of notes with attachments; tagging notifies a partner. */
export function ProjectUpdates({
  projectId,
  updates,
  users,
  currentUserId,
}: {
  projectId: string;
  updates: UpdateInfo[];
  users: UserOption[];
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUpdate.bind(null, projectId),
    {}
  );
  useUndoToast(state);
  const formRef = useRef<HTMLFormElement>(null);
  // Picked file names, shown until the update that carried them is saved.
  const [picked, setPicked] = useState<{ names: string[]; at: number }>({ names: [], at: 0 });
  const fileNames = picked.at > (state.ts ?? 0) ? picked.names : [];
  const [sizeError, setSizeError] = useState<string | null>(null);
  const others = users.filter((u) => u.id !== currentUserId);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="flex flex-col gap-4">
      <form
        ref={formRef}
        action={action}
        className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
      >
        <textarea
          name="body"
          rows={3}
          placeholder="מה חדש בפרויקט?"
          aria-label="עדכון חדש"
          className="w-full resize-y rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          {others.map((u) => (
            <label
              key={u.id}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-medium text-black/60 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
            >
              <input type="checkbox" name="tag" value={u.id} className="sr-only" />
              <AtSign size={13} />
              תיוג {u.name}
            </label>
          ))}
          <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-medium text-black/60 hover:bg-black/5">
            <Paperclip size={13} />
            צירוף קבצים
            <input
              type="file"
              name="files"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                const total = files.reduce((s, f) => s + f.size, 0);
                setSizeError(
                  total > MAX_UPLOAD_BYTES
                    ? `הקבצים גדולים מדי (${formatBytes(total)}). עד ${formatBytes(MAX_UPLOAD_BYTES)} בכל עדכון. לקבצים גדולים: קישור מגוגל דרייב בלשונית "מסמכים".`
                    : null
                );
                setPicked({ names: files.map((f) => f.name), at: Date.now() });
              }}
            />
          </label>
          <button
            type="submit"
            disabled={pending || !!sizeError}
            className="ms-auto flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            <Send size={14} />
            {pending ? "שולח..." : "פרסום"}
          </button>
        </div>
        {fileNames.length > 0 && (
          <p className="text-xs text-black/50">מצורפים: {fileNames.join(", ")}</p>
        )}
        {others.length > 0 && (
          <p className="text-[11px] text-black/40">שותף שמתויג מקבל התראה (בפעמון שבתפריט).</p>
        )}
        {(sizeError || state.error) && (
          <p className="text-sm text-red-600">{sizeError ?? state.error}</p>
        )}
      </form>

      {updates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-10 text-center text-sm text-black/40">
          אין עדיין עדכונים בפרויקט.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {updates.map((u) => (
            <UpdateItem key={u.id} update={u} canDelete={u.author?.id === currentUserId} />
          ))}
        </ol>
      )}
    </section>
  );
}

function UpdateItem({ update, canDelete }: { update: UpdateInfo; canDelete: boolean }) {
  const onResult = useActionResult();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li
      id={`update-${update.id}`}
      className={`scroll-mt-24 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition ${pending ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: update.author?.color ?? "#94a3b8" }}
          >
            {update.author?.name.slice(0, 2) ?? "?"}
          </span>
          <span className="text-sm font-semibold text-brand-900">{update.author?.name ?? "משתמש שהוסר"}</span>
          <time className="text-xs text-black/40" dateTime={new Date(update.createdAt).toISOString()}>
            {timeFormat.format(new Date(update.createdAt))}
          </time>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              if (!confirm("למחוק את העדכון? גם הקבצים שצורפו אליו יימחקו.")) return;
              start(async () => {
                const res = onResult(await deleteUpdate(update.id));
                if (res.error) setError(res.error);
              });
            }}
            aria-label="מחיקת העדכון"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-black/25 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {update.body && <p className="whitespace-pre-line text-sm text-brand-900">{update.body}</p>}
      {update.tagged.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1">
          {update.tagged.map((name) => (
            <span key={name} className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              <AtSign size={11} />
              {name}
            </span>
          ))}
        </p>
      )}
      {update.files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {update.files.map((f) => (
            <FileChip key={f.id} file={f} />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}
