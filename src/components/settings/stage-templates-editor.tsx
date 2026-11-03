"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { Department, StageTemplate } from "@prisma/client";
import {
  createTemplateStage,
  deleteTemplateStage,
  moveTemplateStage,
  renameTemplateStage,
} from "@/lib/actions/stages";
import type { ActionState } from "@/lib/actions/tasks";
import { DEPARTMENTS } from "@/lib/departments";
import { sortStages } from "@/lib/stages";
import { useActionResult } from "@/components/ui/toast";
import { useSyncedState } from "@/lib/use-synced-state";

type Template = Pick<StageTemplate, "id" | "department" | "title" | "order" | "createdAt">;

type Change =
  | { type: "rename"; id: string; title: string }
  | { type: "move"; id: string; direction: "up" | "down" }
  | { type: "delete"; id: string }
  | { type: "add"; item: Template };

function applyChange(items: Template[], change: Change): Template[] {
  switch (change.type) {
    case "rename":
      return items.map((t) => (t.id === change.id ? { ...t, title: change.title } : t));
    case "delete":
      return items.filter((t) => t.id !== change.id);
    case "add":
      return [...items, change.item];
    case "move": {
      const target = items.find((t) => t.id === change.id);
      if (!target) return items;
      const list = sortStages(items.filter((t) => t.department === target.department));
      const from = list.findIndex((t) => t.id === change.id);
      const to = change.direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= list.length) return items;
      [list[from], list[to]] = [list[to], list[from]];
      const orders = new Map(list.map((t, order) => [t.id, order]));
      return items.map((t) => (orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t));
    }
  }
}

export function StageTemplatesEditor({ templates }: { templates: Template[] }) {
  const [items, apply] = useOptimistic(templates, applyChange);
  const [, startTransition] = useTransition();
  const onResult = useActionResult();
  const [error, setError] = useState<string | null>(null);
  // On phones the two departments are tabs; on wider screens, side by side.
  const [tab, setTab] = useState<Department>("DEVELOPER");

  function run(change: Change, save: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      apply(change);
      try {
        const res = onResult(await save());
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.05] p-1 lg:hidden">
        {DEPARTMENTS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="tab"
            aria-selected={tab === d.value}
            onClick={() => setTab(d.value)}
            className={`min-h-10 rounded-lg text-sm font-semibold transition ${
              tab === d.value ? "bg-white text-brand-700 shadow-sm" : "text-black/55"
            }`}
          >
            {d.short}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {DEPARTMENTS.map((d) => (
          <TemplateList
            key={d.value}
            department={d.value}
            label={d.label}
            hiddenOnMobile={tab !== d.value}
            items={sortStages(items.filter((t) => t.department === d.value))}
            run={run}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateList({
  department,
  label,
  hiddenOnMobile,
  items,
  run,
}: {
  department: Department;
  label: string;
  hiddenOnMobile: boolean;
  items: Template[];
  run: (change: Change, save: () => Promise<ActionState>) => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <section
      className={`rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5 ${
        hiddenOnMobile ? "hidden lg:block" : ""
      }`}
    >
      <h2 className="mb-3 text-sm font-bold text-brand-900">
        {label} <span className="font-medium text-black/40">({items.length})</span>
      </h2>

      <ol className="flex flex-col divide-y divide-black/5">
        {items.map((item, i) => (
          <TemplateRow
            key={item.id}
            item={item}
            index={i}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            run={run}
          />
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = title.trim();
          if (!trimmed) return;
          const now = new Date();
          run(
            {
              type: "add",
              item: {
                id: `new-${now.getTime()}`,
                department,
                title: trimmed,
                order: Number.MAX_SAFE_INTEGER,
                createdAt: now,
              },
            },
            () => createTemplateStage(department, trimmed)
          );
          setTitle("");
        }}
        className="mt-3 flex gap-2 border-t border-black/5 pt-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="שלב חדש בתבנית"
          aria-label={`שלב חדש בתבנית ${label}`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus size={16} />
          הוספה
        </button>
      </form>
    </section>
  );
}

function TemplateRow({
  item,
  index,
  isFirst,
  isLast,
  run,
}: {
  item: Template;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  run: (change: Change, save: () => Promise<ActionState>) => void;
}) {
  const [draft, setDraft] = useSyncedState(item.title);
  const saving = item.id.startsWith("new-");

  function save() {
    const title = draft.trim();
    if (!title || title === item.title) {
      setDraft(item.title);
      return;
    }
    run({ type: "rename", id: item.id, title }, () => renameTemplateStage(item.id, title));
  }

  const iconButton =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-black/35 transition hover:bg-black/5 hover:text-brand-700 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <li className={`flex items-center gap-1 py-1.5 ${saving ? "pointer-events-none opacity-60" : ""}`}>
      <span className="w-6 shrink-0 text-center text-xs font-semibold text-black/35">
        {index + 1}
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(item.title);
            e.currentTarget.blur();
          }
        }}
        aria-label={`שם שלב ${index + 1}`}
        className="min-h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm text-brand-900 outline-none transition hover:border-black/10 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
      />
      <button
        type="button"
        disabled={isFirst}
        onClick={() =>
          run({ type: "move", id: item.id, direction: "up" }, () =>
            moveTemplateStage(item.id, "up")
          )
        }
        className={iconButton}
        aria-label="הזזה למעלה"
      >
        <ChevronUp size={17} />
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={() =>
          run({ type: "move", id: item.id, direction: "down" }, () =>
            moveTemplateStage(item.id, "down")
          )
        }
        className={iconButton}
        aria-label="הזזה למטה"
      >
        <ChevronDown size={17} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`להסיר את "${item.title}" מהתבנית? פרויקטים קיימים לא ישתנו.`)) {
            run({ type: "delete", id: item.id }, () => deleteTemplateStage(item.id));
          }
        }}
        className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
        aria-label="הסרה מהתבנית"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
