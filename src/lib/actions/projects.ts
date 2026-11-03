"use server";

import { withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { Department, ProjectStatus } from "@prisma/client";
import type { ActionState } from "@/lib/actions/tasks";
import { departmentHref, departmentMeta, isDepartment } from "@/lib/departments";

export type { ActionState };

function toOptionalDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? new Date(str) : null;
}

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

/** Every page that lists projects by department. */
function revalidateProjectLists() {
  revalidatePath("/projects");
  revalidatePath("/departments/[slug]", "page");
  revalidatePath("/dashboard");
}

/** The owner (אחראי) must be one of the partners; empty means no owner. */
async function parseOwnerId(
  value: FormDataEntryValue | null
): Promise<{ ownerId: string | null; error?: string }> {
  const id = String(value ?? "").trim();
  if (!id) return { ownerId: null };
  const owner = await prisma.user.findFirst({
    where: { id, role: "PARTNER" },
    select: { id: true },
  });
  return owner
    ? { ownerId: owner.id }
    : { ownerId: null, error: "אחראי לא חוקי" };
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
  return withUndo("הפרויקט נוצר", async () => {
    const user = await requireUser();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "יש להזין שם פרויקט" };

    const department = formData.get("department");
    if (!isDepartment(department)) return { error: "יש לבחור מחלקה" };

    const owner = await parseOwnerId(formData.get("ownerId"));
    if (owner.error) return { error: owner.error };

    // A new project starts with its department's stage template (SPEC §3.3).
    const templates = await prisma.stageTemplate.findMany({
      where: { department },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { title: true },
    });
    const stageDue = formData.getAll("stageDue").map((v) => toOptionalDate(v));

    const project = await prisma.project.create({
      data: {
        name,
        department,
        ownerId: owner.ownerId,
        city: toOptionalString(formData.get("city")),
        milestones: {
          // Planned dates proposed by the form (spread evenly, editable), in template order.
          create: templates.map((t, order) => ({ title: t.title, order, dueDate: stageDue[order] ?? null })),
        },
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

    revalidateProjectLists();
    return { ok: true, ts: Date.now() };
  });
}

export async function updateProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הפרויקט עודכן", async () => {
    const user = await requireUser();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "יש להזין שם פרויקט" };

    const prevProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    const status = (formData.get("status") as ProjectStatus) || "PLANNING";

    // Required once set; an existing unassigned project may stay unassigned.
    const departmentValue = formData.get("department");
    if (departmentValue && !isDepartment(departmentValue)) {
      return { error: "מחלקה לא חוקית" };
    }
    if (!departmentValue && prevProject?.department) {
      return { error: "יש לבחור מחלקה" };
    }
    const department = isDepartment(departmentValue) ? departmentValue : null;

    const owner = await parseOwnerId(formData.get("ownerId"));
    if (owner.error) return { error: owner.error };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        department,
        ownerId: owner.ownerId,
        city: toOptionalString(formData.get("city")),
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

    revalidateProjectLists();
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, ts: Date.now() };
  });
}

/** Quick assignment from the "שיוך מחלקות" screen. */
export async function setProjectDepartment(
  projectId: string,
  department: Department
): Promise<ActionState> {
  return withUndo("המחלקה עודכנה", async () => {
    const user = await requireUser();
    if (!isDepartment(department)) return { error: "מחלקה לא חוקית" };

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { department },
      select: { name: true },
    });
    await prisma.activity.create({
      data: {
        message: `${user.name} שייך/ה את הפרויקט "${project.name}" למחלקת ${departmentMeta(department).short}`,
        actorId: user.id,
        projectId,
      },
    });

    revalidateProjectLists();
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, ts: Date.now() };
  });
}

/** Rename from the "שיוך מחלקות" screen (SPEC §3.1: "פיקוח יזם" is not a name). */
export async function renameProject(
  projectId: string,
  name: string
): Promise<ActionState> {
  return withUndo("שם הפרויקט עודכן", async () => {
    await requireUser();
    const trimmed = name.trim();
    if (!trimmed) return { error: "יש להזין שם פרויקט" };

    await prisma.project.update({
      where: { id: projectId },
      data: { name: trimmed },
    });

    revalidateProjectLists();
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, ts: Date.now() };
  });
}

/** "העבר לארכיון" (SPEC §3.4): the safe default instead of deleting. */
export async function setProjectArchived(
  projectId: string,
  archived: boolean
): Promise<ActionState> {
  return withUndo(archived ? "הפרויקט הועבר לארכיון" : "הפרויקט הוחזר מהארכיון", async () => {
    const user = await requireUser();
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: archived ? new Date() : null },
      select: { name: true },
    });
    await prisma.activity.create({
      data: {
        message: archived
          ? `${user.name} העביר/ה את הפרויקט "${project.name}" לארכיון`
          : `${user.name} החזיר/ה את הפרויקט "${project.name}" מהארכיון`,
        actorId: user.id,
        projectId,
      },
    });
    revalidateProjectLists();
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, ts: Date.now() };
  });
}

/**
 * Full delete - only after a double confirmation (SPEC §3.4): the screen asks
 * twice, and the project's name must be typed exactly.
 */
export async function deleteProject(
  projectId: string,
  confirmName: string
): Promise<ActionState> {
  return withUndo("הפרויקט נמחק", async () => {
    await requireUser();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, department: true },
    });
    if (!project) return { error: "הפרויקט לא נמצא" };
    if (confirmName.trim() !== project.name.trim()) {
      return { error: "השם שהוקלד לא תואם לשם הפרויקט. הפרויקט לא נמחק." };
    }
    await prisma.project.delete({ where: { id: projectId } });
    revalidateProjectLists();
    return { ok: true, redirectTo: departmentHref(project.department) };
  });
}
