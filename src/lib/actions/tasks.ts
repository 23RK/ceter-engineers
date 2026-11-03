"use server";

import { withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export type ActionState = {
  error?: string;
  ok?: boolean;
  ts?: number;
  /** "בטל" (stage 5b): set by withUndo when the action changed something. */
  undo?: { id: string; label: string };
  /** Where to go after it (e.g. after deleting the page you were on). */
  redirectTo?: string;
};

function toOptionalDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? new Date(str) : null;
}

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

export async function createTask(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("המשימה נוספה", async () => {
    const user = await requireUser();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "יש להזין כותרת למשימה" };

    const assigneeId = toOptionalString(formData.get("assigneeId"));
    const projectId = toOptionalString(formData.get("projectId"));

    await prisma.task.create({
      data: {
        title,
        description: toOptionalString(formData.get("description")),
        status: (formData.get("status") as TaskStatus) || "TODO",
        priority: (formData.get("priority") as TaskPriority) || "MEDIUM",
        dueDate: toOptionalDate(formData.get("dueDate")),
        startDate: toOptionalDate(formData.get("startDate")),
        assigneeId,
        projectId,
        createdById: user.id,
      },
    });

    if (projectId) {
      await prisma.activity.create({
        data: {
          message: `${user.name} יצר/ה משימה חדשה: "${title}"`,
          actorId: user.id,
          projectId,
        },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/departments/[slug]", "page");
    return { ok: true, ts: Date.now() };
  });
}

export async function updateTask(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("המשימה עודכנה", async () => {
    await requireUser();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "יש להזין כותרת למשימה" };

    const assigneeId = toOptionalString(formData.get("assigneeId"));
    const projectId = toOptionalString(formData.get("projectId"));

    await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description: toOptionalString(formData.get("description")),
        status: (formData.get("status") as TaskStatus) || "TODO",
        priority: (formData.get("priority") as TaskPriority) || "MEDIUM",
        dueDate: toOptionalDate(formData.get("dueDate")),
        startDate: toOptionalDate(formData.get("startDate")),
        assigneeId,
        projectId,
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/departments/[slug]", "page");
    return { ok: true, ts: Date.now() };
  });
}

export async function deleteTask(taskId: string): Promise<ActionState> {
  return withUndo("המשימה נמחקה", async () => {
    await requireUser();
    await prisma.task.delete({ where: { id: taskId } });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/departments/[slug]", "page");
    return { ok: true };
  });
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<ActionState> {
  return withUndo("סטטוס המשימה עודכן", async () => {
    const user = await requireUser();
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    if (task.projectId && status === "DONE") {
      await prisma.activity.create({
        data: {
          message: `${user.name} סימן/ה את המשימה "${task.title}" כהושלמה`,
          actorId: user.id,
          projectId: task.projectId,
        },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/departments/[slug]", "page");
    return { ok: true };
  });
}

/**
 * Inline edit from the project's task list (SPEC §3.4): status, assignee
 * (a partner, or nobody) and due date.
 */
export async function patchTask(
  taskId: string,
  patch: { status?: TaskStatus; assigneeId?: string | null; dueDate?: string | null }
): Promise<ActionState> {
  return withUndo("המשימה עודכנה", async () => {
    const user = await requireUser();
    const data: { status?: TaskStatus; assigneeId?: string | null; dueDate?: Date | null } = {};
    if (patch.status !== undefined) {
      if (!["TODO", "IN_PROGRESS", "REVIEW", "DONE"].includes(patch.status)) {
        return { error: "סטטוס לא חוקי" };
      }
      data.status = patch.status;
    }
    if ("assigneeId" in patch) {
      if (patch.assigneeId) {
        const ok = await prisma.user.findFirst({
          where: { id: patch.assigneeId, role: "PARTNER" },
          select: { id: true },
        });
        if (!ok) return { error: "אחראי לא חוקי" };
      }
      data.assigneeId = patch.assigneeId || null;
    }
    if ("dueDate" in patch) {
      data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    }

    const task = await prisma.task.update({ where: { id: taskId }, data });
    if (task.projectId && patch.status === "DONE") {
      await prisma.activity.create({
        data: {
          message: `${user.name} סימן/ה את המשימה "${task.title}" כהושלמה`,
          actorId: user.id,
          projectId: task.projectId,
        },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
    return { ok: true, ts: Date.now() };
  });
}
