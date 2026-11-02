"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

const MENU_WIDTH = 224; // px, w-56

/**
 * The "⋯" menu (SPEC §3.4: dangerous actions live here, not as buttons).
 * The list is drawn on top of the page (a portal with fixed position), so a
 * scrolling container - like the inspections table - never clips it.
 */
export function MoreMenu({ items, label = "פעולות נוספות" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  /** Under the button, inside the viewport (above it when there's no room below). */
  function openMenu() {
    const r = button.current!.getBoundingClientRect();
    const height = items.length * 44 + 8;
    const below = r.bottom + 4 + height <= window.innerHeight;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - height - 4), left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Scrolling the page or a table moves the button away - close instead of floating.
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-black/60 transition hover:bg-black/5"
      >
        <Ellipsis size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            dir="rtl"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: MENU_WIDTH }}
            className="animate-fade-in fixed z-[70] overflow-hidden rounded-xl border border-black/5 bg-white py-1 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center gap-2.5 px-4 text-right text-sm font-medium transition ${
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-brand-900 hover:bg-black/5"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
