"use server";

import { withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import type { Department, StageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { isDepartment } from "@/lib/departments";
import { israelToday } from "@/lib/format";
import {
  isStageStatus,
  missingTemplateTitles,
  sortStages,
  statusChanges,
} from "@/lib/stages";

const ok = (): ActionState => ({ ok: true, ts: Date.now() });

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/departments/[slug]", "page");
  revalidatePath("/dashboard");
}

/** "yyyy-mm-dd" from a date input -> Date; "" -> null; undefined -> unchanged. */
function parseDateInput(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const str = (value ?? "").trim();
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function projectStages(projectId: string) {
  return prisma.milestone.findMany({
    where: { projectId },
    select: { id: true, status: true, order: true, createdAt: true, title: true },
  });
}

// --------------------------------------------------------------------------
// A project's stages

/**
 * Sets a stage's status. "הושלם" saves today as the actual date (unless one
 * was already entered) and starts the next stage that hasn't started (see
 * statusChanges). Leaving "הושלם" clears the actual date.
 */
export async function setStageStatus(
  stageId: string,
  status: StageStatus
): Promise<ActionState> {
  return withUndo("סטטוס השלב עודכן", async () => {
    const user = await requireUser();
    if (!isStageStatus(status)) return { error: "סטטוס לא חוקי" };

    const stage = await prisma.milestone.findUnique({
      where: { id: stageId },
      select: { projectId: true, title: true, status: true, completedAt: true },
    });
    if (!stage) return { error: "השלב לא נמצא" };
    if (stage.status === status) return ok();

    const stages = await projectStages(stage.projectId);
    const changes = statusChanges(stages, stageId, status);
    const today = israelToday();

    await prisma.$transaction([
      ...changes.map((change) =>
        prisma.milestone.update({
          where: { id: change.id },
          data:
            change.id === stageId
              ? {
                  status: change.status,
                  done: change.status === "DONE",
                  completedAt:
                    change.status === "DONE" ? (stage.completedAt ?? today) : null,
                }
              : { status: change.status },
        })
      ),
      ...(status === "DONE"
        ? [
            prisma.activity.create({
              data: {
                message: `${user.name} סימן/ה את השלב "${stage.title}" כהושלם`,
                actorId: user.id,
                projectId: stage.projectId,
              },
            }),
          ]
        : []),
    ]);

    revalidateProject(stage.projectId);
    return ok();
  });
}

export async function updateStage(
  stageId: string,
  fields: { title?: string; dueDate?: string | null; completedAt?: string | null }
): Promise<ActionState> {
  return withUndo("השלב עודכן", async () => {
    await requireUser();

    const data: { title?: string; dueDate?: Date | null; completedAt?: Date | null } = {};
    if (fields.title !== undefined) {
      const title = fields.title.trim();
      if (!title) return { error: "יש להזין שם לשלב" };
      data.title = title;
    }
    const dueDate = parseDateInput(fields.dueDate);
    if (dueDate !== undefined) data.dueDate = dueDate;
    const completedAt = parseDateInput(fields.completedAt);
    if (completedAt !== undefined) data.completedAt = completedAt;

    const stage = await prisma.milestone.update({
      where: { id: stageId },
      data,
      select: { projectId: true },
    });
    revalidateProject(stage.projectId);
    return ok();
  });
}

export async function createStage(
  projectId: string,
  title: string,
  dueDate?: string | null
): Promise<ActionState> {
  return withUndo("השלב נוסף", async () => {
    await requireUser();
    const trimmed = title.trim();
    if (!trimmed) return { error: "יש להזין שם לשלב" };

    const last = await prisma.milestone.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.milestone.create({
      data: {
        projectId,
        title: trimmed,
        dueDate: parseDateInput(dueDate) ?? null,
        order: (last?.order ?? -1) + 1,
      },
    });
    revalidateProject(projectId);
    return ok();
  });
}

export async function deleteStage(stageId: string): Promise<ActionState> {
  return withUndo("השלב נמחק", async () => {
    await requireUser();
    const stage = await prisma.milestone.delete({
      where: { id: stageId },
      select: { projectId: true },
    });
    revalidateProject(stage.projectId);
    return ok();
  });
}

/**
 * Moves an item one place up/down: renumbers the list 0..n-1 in its current
 * order (older data may have duplicate orders), then swaps the two.
 */
function reorderedIds<T extends { id: string; order: number; createdAt: Date }>(
  items: T[],
  id: string,
  direction: "up" | "down"
) {
  const ids = sortStages(items).map((s) => s.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

export async function moveStage(
  stageId: string,
  direction: "up" | "down"
): Promise<ActionState> {
  return withUndo("סדר השלבים עודכן", async () => {
    await requireUser();
    const stage = await prisma.milestone.findUnique({
      where: { id: stageId },
      select: { projectId: true },
    });
    if (!stage) return { error: "השלב לא נמצא" };

    const ids = reorderedIds(await projectStages(stage.projectId), stageId, direction);
    if (!ids) return ok();
    await prisma.$transaction(
      ids.map((id, order) => prisma.milestone.update({ where: { id }, data: { order } }))
    );
    revalidateProject(stage.projectId);
    return ok();
  });
}

/** Appends the department template's stages the project doesn't have yet. */
export async function addTemplateStages(projectId: string): Promise<ActionState> {
  return withUndo("שלבי התבנית נוספו", async () => {
    const user = await requireUser();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { department: true },
    });
    if (!project?.department) return { error: "יש לשייך את הפרויקט למחלקה קודם" };

    const [templates, stages] = await Promise.all([
      prisma.stageTemplate.findMany({
        where: { department: project.department },
        orderBy: { order: "asc" },
        select: { title: true },
      }),
      projectStages(projectId),
    ]);
    const titles = missingTemplateTitles(
      templates.map((t) => t.title),
      stages.map((s) => s.title)
    );
    if (titles.length === 0) return ok();

    const start = stages.reduce((max, s) => Math.max(max, s.order), -1) + 1;
    await prisma.$transaction([
      prisma.milestone.createMany({
        data: titles.map((title, i) => ({ projectId, title, order: start + i })),
      }),
      prisma.activity.create({
        data: {
          message: `${user.name} הוסיף/ה ${titles.length} שלבים מהתבנית`,
          actorId: user.id,
          projectId,
        },
      }),
    ]);
    revalidateProject(projectId);
    return ok();
  });
}

// --------------------------------------------------------------------------
// Stage templates (Settings). Changes apply to new projects only.

function revalidateTemplates() {
  revalidatePath("/settings/stages");
}

export async function createTemplateStage(
  department: Department,
  title: string
): Promise<ActionState> {
  return withUndo("השלב נוסף לתבנית", async () => {
    await requireUser();
    if (!isDepartment(department)) return { error: "מחלקה לא חוקית" };
    const trimmed = title.trim();
    if (!trimmed) return { error: "יש להזין שם לשלב" };

    const last = await prisma.stageTemplate.findFirst({
      where: { department },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.stageTemplate.create({
      data: { department, title: trimmed, order: (last?.order ?? -1) + 1 },
    });
    revalidateTemplates();
    return ok();
  });
}

export async function renameTemplateStage(
  id: string,
  title: string
): Promise<ActionState> {
  return withUndo("השלב בתבנית עודכן", async () => {
    await requireUser();
    const trimmed = title.trim();
    if (!trimmed) return { error: "יש להזין שם לשלב" };
    await prisma.stageTemplate.update({ where: { id }, data: { title: trimmed } });
    revalidateTemplates();
    return ok();
  });
}

export async function deleteTemplateStage(id: string): Promise<ActionState> {
  return withUndo("השלב נמחק מהתבנית", async () => {
    await requireUser();
    await prisma.stageTemplate.delete({ where: { id } });
    revalidateTemplates();
    return ok();
  });
}

export async function moveTemplateStage(
  id: string,
  direction: "up" | "down"
): Promise<ActionState> {
  return withUndo("סדר התבנית עודכן", async () => {
    await requireUser();
    const item = await prisma.stageTemplate.findUnique({
      where: { id },
      select: { department: true },
    });
    if (!item) return { error: "השלב לא נמצא" };

    const all = await prisma.stageTemplate.findMany({
      where: { department: item.department },
      select: { id: true, order: true, createdAt: true },
    });
    const ids = reorderedIds(all, id, direction);
    if (!ids) return ok();
    await prisma.$transaction(
      ids.map((tid, order) =>
        prisma.stageTemplate.update({ where: { id: tid }, data: { order } })
      )
    );
    revalidateTemplates();
    return ok();
  });
}
