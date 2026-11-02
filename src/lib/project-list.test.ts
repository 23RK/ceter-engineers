import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectStatus } from "@prisma/client";
import {
  NO_OWNER,
  citiesOf,
  filterProjects,
  isArchived,
  kanbanColumns,
  sortProjects,
  toProjectRow,
  type ProjectFilters,
  type ProjectRow,
} from "./project-list";

const ron = { id: "ron", name: "רון", color: "#000" };
const guy = { id: "guy", name: "גיא", color: "#111" };

function row(id: string, over: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id,
    name: id,
    client: null,
    city: null,
    status: "ACTIVE",
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    owner: null,
    currentStage: { title: "יסודות", status: "IN_PROGRESS" },
    stageCount: 3,
    doneCount: 1,
    nextMilestone: null,
    fee: null,
    ...over,
  };
}

const all: ProjectFilters = { status: "", owner: "", city: "", archive: false };

test("archive: done, canceled and archived-by-hand projects", () => {
  const s = (status: ProjectStatus) => ({ status, archivedAt: null });
  assert.equal(isArchived(s("ACTIVE")), false);
  assert.equal(isArchived(s("ON_HOLD")), false);
  assert.equal(isArchived(s("DONE")), true);
  assert.equal(isArchived(s("CANCELED")), true);
  assert.equal(isArchived({ status: "ACTIVE", archivedAt: new Date() }), true);
});

test("the main list hides the archive; the archive toggle shows only it", () => {
  const rows = [row("a"), row("b", { status: "DONE" }), row("c", { archivedAt: new Date() })];
  assert.deepEqual(filterProjects(rows, all).map((r) => r.id), ["a"]);
  assert.deepEqual(
    filterProjects(rows, { ...all, archive: true }).map((r) => r.id),
    ["b", "c"]
  );
});

test("filters by status, owner (including no owner) and city", () => {
  const rows = [
    row("a", { owner: ron, city: "חיפה" }),
    row("b", { owner: guy, city: "חיפה ", status: "PLANNING" }),
    row("c", { city: "אילת" }),
  ];
  const ids = (f: Partial<ProjectFilters>) =>
    filterProjects(rows, { ...all, ...f }).map((r) => r.id);
  assert.deepEqual(ids({ owner: "ron" }), ["a"]);
  assert.deepEqual(ids({ owner: NO_OWNER }), ["c"]);
  assert.deepEqual(ids({ city: "חיפה" }), ["a", "b"]);
  assert.deepEqual(ids({ status: "PLANNING" }), ["b"]);
  assert.deepEqual(citiesOf(rows), ["אילת", "חיפה"]);
});

test("sorting by next milestone puts projects without a date last", () => {
  const rows = [
    row("none"),
    row("late", { nextMilestone: { title: "x", dueDate: new Date("2026-05-01") } }),
    row("soon", { nextMilestone: { title: "x", dueDate: new Date("2026-02-01") } }),
  ];
  assert.deepEqual(sortProjects(rows, "milestone").map((r) => r.id), [
    "soon",
    "late",
    "none",
  ]);
});

test("kanban: template order, then other stage names, then done and no stages", () => {
  const rows = [
    row("a", { currentStage: { title: "שלד", status: "IN_PROGRESS" } }),
    row("b", { currentStage: { title: "יסודות", status: "NOT_STARTED" } }),
    row("c", { currentStage: { title: "בדיקת קרקע", status: "IN_PROGRESS" } }),
    row("d", { currentStage: null, stageCount: 4, doneCount: 4 }),
    row("e", { currentStage: null, stageCount: 0, doneCount: 0 }),
  ];
  const columns = kanbanColumns(rows, ["היתר בנייה", "יסודות", "שלד"]);
  assert.deepEqual(
    columns.map((c) => [c.title, c.projects.map((p) => p.id)]),
    [
      ["יסודות", ["b"]],
      ["שלד", ["a"]],
      ["בדיקת קרקע", ["c"]],
      ["כל השלבים הושלמו", ["d"]],
      ["ללא שלבים", ["e"]],
    ]
  );
});

test("toProjectRow derives the current stage and the next milestone", () => {
  const d = new Date("2026-03-01");
  const r = toProjectRow({
    ...row("p"),
    milestones: [
      { id: "1", title: "א", status: "DONE", order: 0, dueDate: null, createdAt: d },
      { id: "2", title: "ב", status: "NOT_STARTED", order: 1, dueDate: d, createdAt: d },
    ],
  });
  assert.deepEqual(r.currentStage, { title: "ב", status: "NOT_STARTED" });
  assert.deepEqual(r.nextMilestone, { title: "ב", dueDate: d });
  assert.equal(r.stageCount, 2);
  assert.equal(r.doneCount, 1);
});
