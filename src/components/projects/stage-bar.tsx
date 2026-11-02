"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { StageStatus } from "@prisma/client";
import { currentStage, sortStages } from "@/lib/stages";
import { formatDateShort, isOverdue } from "@/lib/format";
import { openProjectTab, TabLink } from "@/components/projects/project-tabs";

type Stage = {
  id: string;
  title: string;
  status: StageStatus;
  order: number;
  createdAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
};

/**
 * The horizontal stage bar at the top of the project page (SPEC §3.4): where
 * the project is. Tapping a stage opens the "שלבים ואבני דרך" tab.
 */
export function StageBar({ stages }: { stages: Stage[] }) {
  const sorted = sortStages(stages);
  const current = currentStage(sorted);
  const doneCount = sorted.filter((s) => s.status === "DONE").length;
  const scroller = useRef<HTMLOListElement>(null);

  // Which sides have more stages out of view (RTL: scrollLeft is 0 at the
  // start/right and negative towards the left). Updated from scroll / resize
  // callbacks, and used to fade the cut-off edge instead of chopping a label.
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const measure = () => {
      const max = box.scrollWidth - box.clientWidth;
      const pos = Math.abs(box.scrollLeft);
      setMore({ start: pos > 2, end: max - pos > 2 });
    };
    // Start with the current stage in view (16 stages don't fit on a phone).
    box.querySelector<HTMLElement>("[data-current]")?.scrollIntoView({ inline: "center", block: "nearest" });
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    box.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      box.removeEventListener("scroll", measure);
    };
  }, []);
  const fade = 28;
  const mask =
    more.start || more.end
      ? `linear-gradient(to left, ${more.start ? "transparent" : "black"} 0, black ${fade}px, black calc(100% - ${fade}px), ${more.end ? "transparent" : "black"} 100%)`
      : undefined;

  if (sorted.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-black/10 px-4 py-3 text-sm text-black/45">
        אין עדיין שלבים בפרויקט.
        <TabLink tab="stages">להוספת שלבים</TabLink>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-brand-900">
          <span className="text-black/45">שלב נוכחי: </span>
          <span className="font-bold">
            {current ? current.title : "כל השלבים הושלמו"}
          </span>
        </p>
        <span className="text-xs font-medium text-black/45">
          {doneCount} מתוך {sorted.length} הושלמו
        </span>
      </div>
      <ol
        ref={scroller}
        aria-label="שלבי הפרויקט"
        className="relative flex overflow-x-auto pb-1 [scrollbar-width:thin]"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {sorted.map((stage, i) => {
          const done = stage.status === "DONE";
          const isCurrent = stage.id === current?.id;
          const overdue = !done && isOverdue(stage.dueDate);
          const date = done ? stage.completedAt : stage.dueDate;
          return (
            <li
              key={stage.id}
              data-current={isCurrent || undefined}
              className="relative flex min-w-24 flex-1 flex-col items-center sm:min-w-28"
            >
              {/* The connecting line to the previous stage (RTL: to the right). */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-3 right-0 h-0.5 w-1/2 -translate-y-1/2 ${
                    done || isCurrent ? "bg-brand-500" : "bg-black/10"
                  }`}
                />
              )}
              {i < sorted.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute top-3 left-0 h-0.5 w-1/2 -translate-y-1/2 ${
                    done ? "bg-brand-500" : "bg-black/10"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => openProjectTab("stages")}
                title={`${stage.title}${date ? ` · ${formatDateShort(date)}` : ""}`}
                aria-current={isCurrent ? "step" : undefined}
                className="relative z-10 flex flex-col items-center gap-1 px-1"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition ${
                    done
                      ? "border-brand-600 bg-brand-600 text-white"
                      : isCurrent
                        ? "border-blue-500 bg-white text-blue-600 ring-4 ring-blue-500/20"
                        : overdue
                          ? "border-red-400 bg-white text-red-500"
                          : "border-black/15 bg-white text-black/40"
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={`line-clamp-2 text-center text-[11px] leading-tight ${
                    isCurrent
                      ? "font-bold text-brand-900"
                      : done
                        ? "text-black/45"
                        : "text-black/55"
                  }`}
                >
                  {stage.title}
                </span>
                {date && (
                  <span
                    className={`text-[10px] ${overdue ? "font-semibold text-red-600" : "text-black/35"}`}
                  >
                    {formatDateShort(date)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
