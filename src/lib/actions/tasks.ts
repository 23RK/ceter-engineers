"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export type ActionState = {
  error?: string;
  ok?: boolean;
  ts?: number;
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
  return { ok: true, ts: Date.now() };
}

export async function updateTask(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
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
  return { ok: true, ts: Date.now() };
}

export async function deleteTask(taskId: string) {
  await requireUser();
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
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
}
