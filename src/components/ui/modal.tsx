"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-fade-in my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-900">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
