import { test } from "node:test";
import assert from "node:assert/strict";
import type { StageStatus } from "@prisma/client";
import {
  currentStage,
  isBeforeProjectStart,
  missingTemplateTitles,
  nextMilestone,
  statusChanges,
} from "./stages";

const stage = (id: string, order: number, status: StageStatus) => ({
  id,
  order,
  status,
});

test("completing a stage starts the next one that hasn't started", () => {
  const stages = [
    stage("a", 0, "IN_PROGRESS"),
    stage("b", 1, "NOT_STARTED"),
    stage("c", 2, "NOT_STARTED"),
  ];
  assert.deepEqual(statusChanges(stages, "a", "DONE"), [
    { id: "a", status: "DONE" },
    { id: "b", status: "IN_PROGRESS" },
  ]);
});

test("completing skips stages already done, and leaves one in progress alone", () => {
  const skipDone = [
    stage("a", 0, "NOT_STARTED"),
    stage("b", 1, "DONE"),
    stage("c", 2, "NOT_STARTED"),
  ];
  assert.deepEqual(statusChanges(skipDone, "a", "DONE"), [
    { id: "a", status: "DONE" },
    { id: "c", status: "IN_PROGRESS" },
  ]);

  const nextInProgress = [stage("a", 0, "IN_PROGRESS"), stage("b", 1, "IN_PROGRESS")];
  assert.deepEqual(statusChanges(nextInProgress, "a", "DONE"), [
    { id: "a", status: "DONE" },
  ]);
});

test("un-completing or completing the last stage changes nothing else", () => {
  const stages = [stage("a", 0, "DONE"), stage("b", 1, "IN_PROGRESS")];
  assert.deepEqual(statusChanges(stages, "a", "NOT_STARTED"), [
    { id: "a", status: "NOT_STARTED" },
  ]);
  assert.deepEqual(statusChanges(stages, "b", "DONE"), [{ id: "b", status: "DONE" }]);
  // Re-marking a done stage as done doesn't start anything.
  const again = [stage("a", 0, "DONE"), stage("b", 1, "NOT_STARTED")];
  assert.deepEqual(statusChanges(again, "a", "DONE"), [{ id: "a", status: "DONE" }]);
  assert.deepEqual(statusChanges(again, "missing", "DONE"), []);
});

test("current stage and next milestone", () => {
  const stages = [
    stage("c", 2, "NOT_STARTED"),
    stage("a", 0, "DONE"),
    stage("b", 1, "NOT_STARTED"),
  ];
  assert.equal(currentStage(stages)?.id, "b");
  assert.equal(nextMilestone(stages)?.id, "b");

  const withProgress = [...stages, stage("d", 3, "IN_PROGRESS")];
  assert.equal(currentStage(withProgress)?.id, "d");
  assert.equal(nextMilestone(withProgress)?.id, "b");

  assert.equal(currentStage([stage("a", 0, "DONE")]), null);
  assert.equal(nextMilestone([]), null);
});

test("planned-before-start validation", () => {
  assert.equal(isBeforeProjectStart("2026-01-01", "2026-02-01"), true);
  assert.equal(isBeforeProjectStart("2026-02-01", "2026-02-01"), false);
  assert.equal(isBeforeProjectStart(null, "2026-02-01"), false);
  assert.equal(isBeforeProjectStart("2026-01-01", null), false);
});

test("adding template stages never duplicates existing ones", () => {
  assert.deepEqual(
    missingTemplateTitles(["היתר בנייה", "יסודות", "שלד"], ["יסודות ", "משהו אחר"]),
    ["היתר בנייה", "שלד"]
  );
});
