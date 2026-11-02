import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Images and PDFs open in the browser; anything else downloads. Uploaded
// content is never run as a page on our origin (sandbox CSP + nosniff).
const INLINE = /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf)$/;

/** Download a project file (the proxy skips /api, so the sign-in check is here). */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const file = await prisma.projectFile.findUnique({
    where: { id },
    select: { name: true, mimeType: true, url: true, data: { select: { data: true } } },
  });
  if (!file) return new NextResponse("Not found", { status: 404 });
  if (file.url) return NextResponse.redirect(file.url);
  if (!file.data) return new NextResponse("Not found", { status: 404 });

  const type = file.mimeType ?? "application/octet-stream";
  const inline = INLINE.test(type) && new URL(request.url).searchParams.get("download") !== "1";
  return new NextResponse(new Uint8Array(file.data.data), {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
