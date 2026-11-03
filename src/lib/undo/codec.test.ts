import { test } from "node:test";
import assert from "node:assert/strict";
import { changedFields, decodeRow, encodeRow, plainData, sameValue } from "./codec";
import { childRelations, daysUntil, IGNORED_FIELDS, isTracked, primaryKey, trashKind } from "./models";

test("dates and file bytes survive the trip through JSON", () => {
  const row = { id: "a", due: new Date("2026-11-05T07:00:00.000Z"), data: Buffer.from([1, 2, 3]), n: 1.5, b: false, empty: null };
  const back = decodeRow(JSON.parse(JSON.stringify(encodeRow(row))));
  assert.deepEqual(back.due, row.due);
  assert.deepEqual([...(back.data as Buffer)], [1, 2, 3]);
  assert.equal(back.n, 1.5);
  assert.equal(back.b, false);
  assert.equal(back.empty, null);
});

test("an update records only the columns it changed, before and after", () => {
  const before = { id: "t", title: "א", status: "TODO", dueDate: null, updatedAt: new Date(1) };
  const after = { id: "t", title: "ב", status: "TODO", dueDate: new Date("2026-11-05T00:00:00Z"), updatedAt: new Date(2) };
  const diff = changedFields(before, after, IGNORED_FIELDS)!;
  assert.deepEqual(Object.keys(diff.before).sort(), ["dueDate", "title"]);
  assert.equal(diff.before.title, "א");
  assert.equal(diff.after.title, "ב");
  assert.equal(changedFields(before, { ...before }, IGNORED_FIELDS), null);
});

test("Google bookkeeping and timestamps are never undone", () => {
  const diff = changedFields({ googleEventId: null, googleSyncPending: true }, { googleEventId: "x", googleSyncPending: false }, IGNORED_FIELDS);
  assert.equal(diff, null);
});

test("only plain values from an update's data are taken", () => {
  const scalars = new Set(["title", "order", "projectId"]);
  assert.deepEqual(plainData({ title: "x", order: { increment: 1 }, project: { connect: { id: "p" } }, projectId: { set: "p" } }, scalars), {
    title: "x",
    projectId: "p",
  });
  assert.ok(sameValue(new Date(5), new Date(5)));
  assert.ok(!sameValue(null, ""));
});

test("deleting a project takes its tasks, stages and files with it; a payment's stage link is restored", () => {
  const children = childRelations("Project");
  const cascade = children.filter((c) => c.onDelete === "Cascade").map((c) => c.child);
  for (const m of ["Task", "Milestone", "Payment", "ProjectFile", "ProjectUpdate", "ProjectContact"]) assert.ok(cascade.includes(m), m);
  const stageLinks = childRelations("Milestone").find((c) => c.child === "Payment");
  assert.equal(stageLinks?.onDelete, "SetNull");
  assert.equal(primaryKey("ProjectFileData"), "fileId");
  assert.equal(primaryKey("AppSetting"), "key");
});

test("the machinery's own tables and Google sync state are not recorded", () => {
  assert.equal(isTracked("Task"), true);
  for (const m of ["UndoEntry", "TrashItem", "GoogleAccount"]) assert.equal(isTracked(m), false);
  assert.equal(trashKind("Task").kind, "משימה");
  assert.equal(trashKind("PriceTier").visible, false);
  assert.equal(daysUntil(new Date("2026-12-03T12:00:00Z"), new Date("2026-11-03T12:00:00Z")), 30);
});
