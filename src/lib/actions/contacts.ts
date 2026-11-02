"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { str } from "@/lib/form-values";
import { isContactRole } from "@/lib/contacts";

function contactFields(formData: FormData) {
  return {
    name: str(formData.get("name")),
    company: str(formData.get("company")),
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    notes: str(formData.get("notes")),
  };
}

/**
 * Link a contact to a project with a role: an existing contact from the
 * general list (contactId), or a new one created here.
 */
export async function addProjectContact(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const role = formData.get("role");
  if (!isContactRole(role)) return { error: "יש לבחור תפקיד" };
  const roleNote = str(formData.get("roleNote"));

  let contactId = str(formData.get("contactId"));
  if (contactId) {
    const exists = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true },
    });
    if (!exists) return { error: "איש הקשר לא נמצא" };
  } else {
    const fields = contactFields(formData);
    if (!fields.name) return { error: "יש לבחור איש קשר קיים או להזין שם" };
    const contact = await prisma.contact.create({
      data: { ...fields, name: fields.name },
      select: { id: true },
    });
    contactId = contact.id;
  }

  const duplicate = await prisma.projectContact.findUnique({
    where: { projectId_contactId_role: { projectId, contactId, role } },
    select: { id: true },
  });
  if (duplicate) return { error: "איש הקשר כבר משויך לפרויקט בתפקיד הזה" };

  await prisma.projectContact.create({
    data: { projectId, contactId, role, roleNote },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, ts: Date.now() };
}

/** Edit a contact card. It's shared, so every project that links it sees the change. */
export async function updateContact(
  contactId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const fields = contactFields(formData);
  if (!fields.name) return { error: "יש להזין שם" };
  await prisma.contact.update({
    where: { id: contactId },
    data: { ...fields, name: fields.name },
  });
  revalidatePath("/projects/[id]", "page");
  return { ok: true, ts: Date.now() };
}

/** Removes the contact from this project only; the contact card itself stays. */
export async function removeProjectContact(linkId: string): Promise<ActionState> {
  await requireUser();
  const link = await prisma.projectContact.delete({
    where: { id: linkId },
    select: { projectId: true },
  });
  revalidatePath(`/projects/${link.projectId}`);
  return { ok: true, ts: Date.now() };
}
