"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Link2, Trash2, Upload } from "lucide-react";
import { addDocumentLink, deleteDocument, uploadDocuments } from "@/lib/actions/updates";
import type { ActionState } from "@/lib/actions/tasks";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/form-values";
import { formatDateShort } from "@/lib/format";
import { useActionResult, useUndoToast } from "@/components/ui/toast";

export type FileInfo = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: Date;
  uploadedBy?: string | null;
  fromUpdate?: boolean;
};

export function fileHref(file: FileInfo) {
  return file.url ?? `/api/files/${file.id}`;
}

function FileIcon({ file }: { file: FileInfo }) {
  if (file.url) return <Link2 size={15} />;
  if (file.mimeType?.startsWith("image/")) return <ImageIcon size={15} />;
  return <FileText size={15} />;
}

/** An attachment: opens in a new tab (images / PDF) or downloads. */
export function FileChip({ file }: { file: FileInfo }) {
  return (
    <a
      href={fileHref(file)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-2.5 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
    >
      <FileIcon file={file} />
      <span className="truncate">{file.name}</span>
      {file.size != null && <span className="shrink-0 text-black/35">{formatBytes(file.size)}</span>}
    </a>
  );
}

/** מסמכים (SPEC §3.4): upload files, or link to files in Google Drive. */
export function ProjectDocuments({ projectId, files }: { projectId: string; files: FileInfo[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <UploadForm projectId={projectId} />
        <LinkForm projectId={projectId} />
      </div>

      {files.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-10 text-center text-sm text-black/40">
          אין עדיין מסמכים בפרויקט.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {files.map((f) => (
            <DocumentRow key={f.id} file={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({ file }: { file: FileInfo }) {
  const onResult = useActionResult();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-40" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <FileIcon file={file} />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={fileHref(file)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm font-medium text-brand-900 hover:text-brand-600"
        >
          <span className="truncate">{file.name}</span>
          {file.url && <ExternalLink size={12} className="shrink-0 text-black/30" />}
        </a>
        <p className="text-xs text-black/40">
          {[
            file.url ? "קישור" : formatBytes(file.size),
            file.uploadedBy,
            formatDateShort(file.createdAt),
            file.fromUpdate ? "מתוך עדכון" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          if (!confirm(`למחוק את "${file.name}"?`)) return;
          start(async () => {
            const res = onResult(await deleteDocument(file.id));
            if (res.error) setError(res.error);
          });
        }}
        aria-label={`מחיקת ${file.name}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/25 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}

const box = "flex flex-col gap-2.5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm";
const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const submitClass =
  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50";

function UploadForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadDocuments.bind(null, projectId),
    {}
  );
  useUndoToast(state);
  const ref = useRef<HTMLFormElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className={box}>
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
        <Upload size={15} />
        העלאת קבצים
      </h3>
      <input
        type="file"
        name="files"
        multiple
        required
        aria-label="בחירת קבצים"
        onChange={(e) => {
          const total = Array.from(e.target.files ?? []).reduce((s, f) => s + f.size, 0);
          setSizeError(
            total > MAX_UPLOAD_BYTES
              ? `גדול מדי (${formatBytes(total)}). עד ${formatBytes(MAX_UPLOAD_BYTES)} בכל העלאה. לקבצים גדולים: קישור מגוגל דרייב.`
              : null
          );
        }}
        className="text-sm file:ml-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-sm file:font-medium file:text-brand-700"
      />
      <p className="text-[11px] text-black/40">עד {formatBytes(MAX_UPLOAD_BYTES)} בכל העלאה.</p>
      {(sizeError || state.error) && <p className="text-sm text-red-600">{sizeError ?? state.error}</p>}
      <button type="submit" disabled={pending || !!sizeError} className={submitClass}>
        {pending ? "מעלה..." : "העלאה"}
      </button>
    </form>
  );
}

function LinkForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addDocumentLink.bind(null, projectId),
    {}
  );
  useUndoToast(state);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className={box}>
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
        <Link2 size={15} />
        קישור לקובץ בגוגל דרייב
      </h3>
      <input name="name" placeholder="שם המסמך (לא חובה)" aria-label="שם המסמך" className={inputClass} />
      <input name="url" type="url" required dir="ltr" placeholder="https://drive.google.com/..." aria-label="קישור" className={`${inputClass} text-right`} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "שומר..." : "הוספת קישור"}
      </button>
    </form>
  );
}
