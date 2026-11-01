"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import type { ProjectStatus } from "@prisma/client";
import type { ActionState } from "@/lib/actions/tasks";

export type { ActionState };

function toOptionalDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? new Date(str) : null;
}

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

function toOptionalFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export async function createProject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePartner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש להזין שם פרויקט" };

  const project = await prisma.project.create({
    data: {
      name,
      client: toOptionalString(formData.get("client")),
      address: toOptionalString(formData.get("address")),
      status: (formData.get("status") as ProjectStatus) || "PLANNING",
      description: toOptionalString(formData.get("description")),
      budget: toOptionalFloat(formData.get("budget")),
      startDate: toOptionalDate(formData.get("startDate")),
      endDate: toOptionalDate(formData.get("endDate")),
    },
  });

  await prisma.activity.create({
    data: {
      message: `${user.name} פתח/ה פרויקט חדש: "${name}"`,
      actorId: user.id,
      projectId: project.id,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true, ts: Date.now() };
}

export async function updateProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePartner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש להזין שם פרויקט" };

  const prevProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  const status = (formData.get("status") as ProjectStatus) || "PLANNING";

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      client: toOptionalString(formData.get("client")),
      address: toOptionalString(formData.get("address")),
      status,
      description: toOptionalString(formData.get("description")),
      budget: toOptionalFloat(formData.get("budget")),
      startDate: toOptionalDate(formData.get("startDate")),
      endDate: toOptionalDate(formData.get("endDate")),
    },
  });

  if (prevProject && prevProject.status !== status) {
    await prisma.activity.create({
      data: {
        message: `${user.name} עדכן/ה את סטטוס הפרויקט "${name}"`,
        actorId: user.id,
        projectId,
      },
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, ts: Date.now() };
}

export async function deleteProject(projectId: string) {
  await requirePartner();
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects");
}

export async function createMilestone(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePartner();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "יש להזין כותרת לאבן דרך" };

  const count = await prisma.milestone.count({ where: { projectId } });

  await prisma.milestone.create({
    data: {
      title,
      dueDate: toOptionalDate(formData.get("dueDate")),
      projectId,
      order: count,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, ts: Date.now() };
}

export async function toggleMilestone(milestoneId: string, done: boolean) {
  await requirePartner();
  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { done },
  });
  revalidatePath(`/projects/${milestone.projectId}`);
}

export async function deleteMilestone(milestoneId: string) {
  await requirePartner();
  const milestone = await prisma.milestone.delete({
    where: { id: milestoneId },
  });
  revalidatePath(`/projects/${milestone.projectId}`);
}
