"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type ProjectTab = {
  key: string;
  label: string;
  /** A small count next to the label (e.g. open tasks). */
  count?: number;
  /** Highlight the count (something needs attention). */
  alert?: boolean;
  content: ReactNode;
};

const EVENT = "project-tab";

/** Switch the project page's tab from anywhere on the page (header stats, overview links). */
export function openProjectTab(key: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

/** A link-looking button that switches tabs. */
export function TabLink({
  tab,
  children,
  className,
}: {
  tab: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openProjectTab(tab)}
      className={className ?? "text-sm font-medium text-brand-600 hover:underline"}
    >
      {children}
    </button>
  );
}

/**
 * The project page's inner tabs (SPEC §3.4). All panels are rendered once,
 * so switching is instant; the active tab is kept in the URL (?tab=).
 */
export function ProjectTabs({ tabs, initial }: { tabs: ProjectTab[]; initial: string }) {
  const [active, setActive] = useState(
    tabs.some((t) => t.key === initial) ? initial : tabs[0].key
  );
  const barRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (!tabs.some((t) => t.key === key)) return;
      setActive(key);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [tabs]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active === tabs[0].key) url.searchParams.delete("tab");
    else url.searchParams.set("tab", active);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // Keep the active tab visible in the scrolling tab bar (phones).
    barRef.current
      ?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, tabs]);

  // A link to a specific update (#update-...) - from a notification.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("ring-2", "ring-brand-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-brand-400"), 2500);
    }
  }, []);

  return (
    <div ref={sectionRef} className="scroll-mt-20 flex flex-col gap-4">
      <div
        ref={barRef}
        role="tablist"
        aria-label="לשוניות הפרויקט"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-black/10 px-4 md:mx-0 md:px-0"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              data-tab={tab.key}
              id={`tab-${tab.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition ${
                selected
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-black/50 hover:text-brand-900"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    tab.alert ? "bg-red-100 text-red-700" : "bg-black/5 text-black/50"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
