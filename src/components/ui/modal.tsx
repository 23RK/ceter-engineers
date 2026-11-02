"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A dialog. Uncontrolled with a `trigger`, or controlled with `open` +
 * `onOpenChange` (e.g. opened from a "⋯" menu item).
 */
export function Modal({
  trigger,
  title,
  children,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (value: boolean) => {
    if (openProp === undefined) setOpenState(value);
    onOpenChange?.(value);
  };

  return (
    <>
      {trigger && (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="animate-fade-in my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-900">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="rounded-lg p-1 text-black/40 transition hover:bg-black/5 hover:text-black/70"
              >
                <X size={18} />
              </button>
            </div>
            {children(() => setOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}
