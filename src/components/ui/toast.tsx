"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Undo2, X } from "lucide-react";
import { undoAction } from "@/lib/actions/undo";
import type { ActionState } from "@/lib/actions/tasks";

// The one toast for the whole app (stage 5b). After every change, the
// action's result carries `undo: { id, label }` and the toast shows the
// label with "בטל" for 8 seconds. Ctrl/⌘+Z does the same as "בטל".

export const UNDO_TOAST_MS = 8000;
const INFO_TOAST_MS = 4000;

type Toast = {
  key: number;
  message: string;
  tone: "info" | "success" | "error";
  undoId?: string;
  busy?: boolean;
  duration: number;
};

type ToastApi = {
  /** A change was made: show it with "בטל". */
  undo: (undo: { id: string; label: string }) => void;
  info: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/**
 * Handles an action's result the same way everywhere: "בטל" toast, and
 * navigation when the action asks for it (e.g. after deleting the page
 * you were on). Errors stay with the form / row that shows them.
 */
export function useActionResult() {
  const toast = useToast();
  const router = useRouter();
  return useCallback(
    <T extends ActionState | void | undefined>(result: T): T => {
      if (result && typeof result === "object") {
        if (result.undo) toast.undo(result.undo);
        if (result.redirectTo) router.push(result.redirectTo);
      }
      return result;
    },
    [toast, router]
  );
}

/** For forms with useActionState: shows "בטל" whenever a new result carries one. */
export function useUndoToast(state: ActionState | undefined) {
  const toast = useToast();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const undo = state?.undo;
    if (undo && shown.current !== undo.id) {
      shown.current = undo.id;
      toast.undo(undo);
    }
  }, [state?.undo, toast]);
}

let nextKey = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((key: number) => {
    setToasts((list) => list.filter((t) => t.key !== key));
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "key">) => {
      const key = nextKey++;
      // Newest at the bottom; at most three on screen.
      setToasts((list) => [...list.slice(-2), { ...toast, key }]);
      timers.current.set(key, setTimeout(() => dismiss(key), toast.duration));
      return key;
    },
    [dismiss]
  );

  const runUndo = useCallback(
    async (toast: Toast) => {
      if (!toast.undoId || toast.busy) return;
      const timer = timers.current.get(toast.key);
      if (timer) clearTimeout(timer);
      setToasts((list) => list.map((t) => (t.key === toast.key ? { ...t, busy: true } : t)));
      let result: Awaited<ReturnType<typeof undoAction>>;
      try {
        result = await undoAction(toast.undoId);
      } catch {
        result = { error: "הביטול נכשל. נסו שוב." };
      }
      dismiss(toast.key);
      if (result.error) {
        push({ message: result.error, tone: "error", duration: INFO_TOAST_MS + 2000 });
      } else {
        push({
          message: result.partial ? "בוטל. חלק מהשינויים כבר שונו שוב, ולכן נשארו." : "הפעולה בוטלה",
          tone: "success",
          duration: INFO_TOAST_MS,
        });
        router.refresh();
      }
    },
    [dismiss, push, router]
  );

  const api = useMemo<ToastApi>(
    () => ({
      undo: ({ id, label }) => push({ message: label, tone: "info", undoId: id, duration: UNDO_TOAST_MS }),
      info: (message) => push({ message, tone: "success", duration: INFO_TOAST_MS }),
      error: (message) => push({ message, tone: "error", duration: INFO_TOAST_MS + 2000 }),
    }),
    [push]
  );

  // Ctrl/⌘+Z: undo the latest change - not while typing in a field.
  const latestUndo = [...toasts].reverse().find((t) => t.undoId && !t.busy);
  useEffect(() => {
    if (!latestUndo) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      void runUndo(latestUndo);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [latestUndo, runUndo]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.key}
            className={`pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.tone === "error" ? "bg-red-700 text-white" : "bg-brand-950 text-white"
            }`}
          >
            {t.tone === "error" ? (
              <CircleAlert size={16} className="shrink-0" />
            ) : t.tone === "success" ? (
              <CircleCheck size={16} className="shrink-0 text-green-300" />
            ) : null}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.undoId && (
              <button
                type="button"
                onClick={() => runUndo(t)}
                disabled={t.busy}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-brand-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                <Undo2 size={14} />
                {t.busy ? "מבטל..." : "בטל"}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.key)}
              className="shrink-0 rounded p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="סגירה"
            >
              <X size={14} />
            </button>
            {t.undoId && !t.busy && (
              <span
                className="absolute bottom-0 right-0 h-0.5 bg-brand-300/70"
                style={{ animation: `toast-countdown ${t.duration}ms linear forwards` }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
