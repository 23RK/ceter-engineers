"use server";

import { withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { MAX_UPLOAD_BYTES, filesOf, formatBytes, safeUrl, str } from "@/lib/form-values";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
}

/** Checks the uploads' total size (one request) before anything is saved. */
function checkFiles(files: File[]): string | null {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return `הקבצים גדולים מדי (${formatBytes(total)}). אפשר עד ${formatBytes(MAX_UPLOAD_BYTES)} בכל העלאה. לקבצים גדולים: קישור מגוגל דרייב.`;
  }
  return null;
}

async function fileRows(files: File[]) {
  return Promise.all(
    files.map(async (f) => ({
      name: f.name.slice(0, 200) || "קובץ",
      mimeType: f.type || "application/octet-stream",
      size: f.size,
      bytes: Buffer.from(await f.arrayBuffer()),
    }))
  );
}

/**
 * A note in the updates thread, with attachments. Tagged partners get a
 * notification (SPEC §3.4).
 */
export async function createUpdate(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("העדכון פורסם", async () => {
    const user = await requireUser();
    const body = str(formData.get("body"));
    const files = filesOf(formData);
    if (!body && files.length === 0) return { error: "יש לכתוב עדכון או לצרף קובץ" };
    const tooBig = checkFiles(files);
    if (tooBig) return { error: tooBig };

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return { error: "הפרויקט לא נמצא" };

    // Only partners can be tagged, and not yourself.
    const taggedIds = formData.getAll("tag").map(String);
    const tagged = taggedIds.length
      ? await prisma.user.findMany({
          where: { id: { in: taggedIds, not: user.id }, role: "PARTNER" },
          select: { id: true },
        })
      : [];

    const rows = await fileRows(files);
    await prisma.$transaction(async (tx) => {
      const update = await tx.projectUpdate.create({
        data: { projectId, authorId: user.id, body: body ?? "" },
      });
      for (const f of rows) {
        await tx.projectFile.create({
          data: {
            projectId,
            updateId: update.id,
            uploadedById: user.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            data: { create: { data: f.bytes } },
          },
        });
      }
      if (tagged.length) {
        await tx.notification.createMany({
          data: tagged.map((t) => ({
            userId: t.id,
            actorId: user.id,
            projectId,
            updateId: update.id,
            message: `${user.name} תייג/ה אותך בעדכון בפרויקט "${project.name}"`,
          })),
        });
      }
      await tx.activity.create({
        data: {
          message: `${user.name} הוסיף/ה עדכון בפרויקט "${project.name}"`,
          actorId: user.id,
          projectId,
        },
      });
    });

    revalidateProject(projectId);
    revalidatePath("/", "layout"); // the notification count
    return { ok: true, ts: Date.now() };
  });
}

/** Only the author can delete their update (its attachments go with it). */
export async function deleteUpdate(updateId: string): Promise<ActionState> {
  return withUndo("העדכון נמחק", async () => {
    const user = await requireUser();
    const update = await prisma.projectUpdate.findUnique({
      where: { id: updateId },
      select: { projectId: true, authorId: true },
    });
    if (!update) return { error: "העדכון לא נמצא" };
    if (update.authorId !== user.id) return { error: "אפשר למחוק רק עדכון שכתבת" };
    await prisma.projectUpdate.delete({ where: { id: updateId } });
    revalidateProject(update.projectId);
    revalidatePath("/", "layout");
    return { ok: true, ts: Date.now() };
  });
}

/** מסמכים: upload files. */
export async function uploadDocuments(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("המסמכים הועלו", async () => {
    const user = await requireUser();
    const files = filesOf(formData);
    if (files.length === 0) return { error: "יש לבחור קובץ" };
    const tooBig = checkFiles(files);
    if (tooBig) return { error: tooBig };

    const rows = await fileRows(files);
    await prisma.$transaction(
      rows.map((f) =>
        prisma.projectFile.create({
          data: {
            projectId,
            uploadedById: user.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            data: { create: { data: f.bytes } },
          },
        })
      )
    );
    revalidateProject(projectId);
    return { ok: true, ts: Date.now() };
  });
}

/** מסמכים: a link to a file (e.g. Google Drive). */
export async function addDocumentLink(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הקישור נוסף", async () => {
    const user = await requireUser();
    const url = safeUrl(formData.get("url"));
    if (!url) return { error: "יש להזין קישור תקין שמתחיל ב-https://" };
    const name = str(formData.get("name")) ?? url;
    await prisma.projectFile.create({
      data: { projectId, uploadedById: user.id, name: name.slice(0, 200), url },
    });
    revalidateProject(projectId);
    return { ok: true, ts: Date.now() };
  });
}

export async function deleteDocument(fileId: string): Promise<ActionState> {
  return withUndo("המסמך נמחק", async () => {
    await requireUser();
    const file = await prisma.projectFile.delete({
      where: { id: fileId },
      select: { projectId: true },
    });
    revalidateProject(file.projectId);
    return { ok: true, ts: Date.now() };
  });
}

/** Open a notification: mark it read and go to the update it's about. */
export async function openNotification(notificationId: string) {
  const user = await requireUser();
  const n = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.id },
    select: { projectId: true, updateId: true },
  });
  if (!n) redirect("/notifications");
  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  redirect(
    n.projectId
      ? `/projects/${n.projectId}?tab=updates${n.updateId ? `#update-${n.updateId}` : ""}`
      : "/notifications"
  );
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: true, ts: Date.now() };
}
