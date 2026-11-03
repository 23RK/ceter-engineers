import { Prisma } from "@prisma/client";

// What the undo / recycle-bin machinery knows about each table, read from
// Prisma's own schema metadata, so a new table or column is covered without
// changes here.

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];
const MODELS = new Map<string, DmmfModel>(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

/** Tables that are never recorded: the machinery itself and Google sync state. */
export const UNTRACKED_MODELS: ReadonlySet<string> = new Set([
  "UndoEntry",
  "TrashItem",
  "GoogleAccount",
  "MeetingGoogleSync",
]);

/**
 * Bookkeeping columns that undo never puts back: timestamps, and the Google
 * sync fields (the calendar is brought up to date after an undo instead).
 */
export const IGNORED_FIELDS: ReadonlySet<string> = new Set([
  "createdAt",
  "updatedAt",
  "googleEventId",
  "googleKey",
  "googleUpdated",
  "googleSyncPending",
  "googleSyncError",
  "googleEventUserId",
  "googleEventHash",
]);

export const isTracked = (model: string | undefined): model is string =>
  Boolean(model && MODELS.has(model) && !UNTRACKED_MODELS.has(model));

/** The Prisma client property for a model ("ProjectFile" -> "projectFile"). */
export const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1);

export function primaryKey(model: string): string {
  const m = MODELS.get(model);
  const id = m?.fields.find((f) => f.isId);
  if (!id) throw new Error(`No single-column primary key on ${model}`);
  return id.name;
}

const scalarCache = new Map<string, Set<string>>();
export function scalarFields(model: string): Set<string> {
  let s = scalarCache.get(model);
  if (!s) {
    s = new Set((MODELS.get(model)?.fields ?? []).filter((f) => f.kind !== "object").map((f) => f.name));
    scalarCache.set(model, s);
  }
  return s;
}

export type ChildRelation = {
  child: string;
  fk: string; // column on the child
  references: string; // column on the parent
  onDelete: "Cascade" | "SetNull" | "Restrict" | "NoAction" | "SetDefault";
};

const childCache = new Map<string, ChildRelation[]>();
/** Tables that point at this one, and what the database does to them when a row here is deleted. */
export function childRelations(parent: string): ChildRelation[] {
  let list = childCache.get(parent);
  if (!list) {
    list = [];
    for (const m of MODELS.values()) {
      for (const f of m.fields) {
        if (f.kind !== "object" || f.type !== parent || f.relationFromFields?.length !== 1) continue;
        const onDelete = (f.relationOnDelete as ChildRelation["onDelete"] | undefined) ??
          (f.isRequired ? "Restrict" : "SetNull"); // Prisma's defaults
        list.push({ child: m.name, fk: f.relationFromFields[0], references: f.relationToFields?.[0] ?? "id", onDelete });
      }
    }
    childCache.set(parent, list);
  }
  return list;
}

// ---------------------------------------------------------------------------
// How a deleted row looks in the recycle bin.

type Row = Record<string, unknown>;
const text = (v: unknown, max = 80) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const day = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10).split("-").reverse().join("/") : "";

export type TrashKind = {
  kind: string;
  title: (row: Row) => string;
  /** Shown in the recycle bin. Incidental rows (price tiers, notifications...) are kept only for undo. */
  visible: boolean;
};

export const TRASH_KINDS: Record<string, TrashKind> = {
  Project: { kind: "פרויקט", title: (r) => text(r.name), visible: true },
  Task: { kind: "משימה", title: (r) => text(r.title), visible: true },
  Lead: { kind: "ליד", title: (r) => text(r.name), visible: true },
  LeadTask: { kind: "משימה בליד", title: (r) => text(r.title), visible: true },
  Meeting: { kind: "פגישה", title: (r) => `${text(r.title)} ${day(r.startTime)}`.trim(), visible: true },
  Payment: { kind: "תשלום", title: (r) => `${text(r.title)}${typeof r.amount === "number" ? ` (₪${r.amount.toLocaleString("he-IL")})` : ""}`, visible: true },
  ProjectUpdate: { kind: "עדכון", title: (r) => text(r.body, 60) || "(עדכון)", visible: true },
  ProjectFile: { kind: "מסמך", title: (r) => text(r.name), visible: true },
  SupervisionReport: { kind: "דוח פיקוח", title: (r) => `ביקור ${day(r.visitDate)}`.trim(), visible: true },
  ChangeOrder: { kind: "שינוי / תוספת", title: (r) => text(r.description), visible: true },
  Milestone: { kind: "שלב", title: (r) => text(r.title), visible: true },
  StageTemplate: { kind: "שלב בתבנית", title: (r) => text(r.title), visible: true },
  Inspector: { kind: "בודק", title: (r) => text(r.name), visible: true },
  InspectorRate: { kind: "תעריף בודק", title: (r) => (typeof r.rate === "number" ? `₪${r.rate}` : "תעריף"), visible: true },
  ProjectContact: { kind: "איש קשר בפרויקט", title: () => "איש קשר", visible: true },
  Contact: { kind: "איש קשר", title: (r) => text(r.name), visible: true },
};

export const trashKind = (model: string): TrashKind =>
  TRASH_KINDS[model] ?? { kind: model, title: () => model, visible: false };

/** Kept this long in the recycle bin; hidden (undo-only) rows much shorter. */
export const TRASH_DAYS = 30;
export const HIDDEN_TRASH_HOURS = 24;
/** How long "בטל" works on the server (the toast shows for ~8 seconds). */
export const UNDO_WINDOW_MS = 10 * 60_000;

/** Whole days left until a recycle-bin item is deleted for good. */
export function daysUntil(when: Date, now = new Date()) {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / 86_400_000));
}
