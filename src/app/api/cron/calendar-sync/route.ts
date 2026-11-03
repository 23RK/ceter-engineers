import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/google/env";
import { runScheduledSync } from "@/lib/google/calendar-sync";
import { purgeExpired } from "@/lib/undo/undo";

// The 10-minute backup sync (decision 4): called by the scheduled GitHub
// Actions workflow (.github/workflows/calendar-sync.yml) with
// "Authorization: Bearer <CRON_SECRET>". Renews the push channels, catches
// up on missed notifications, and retries writes to Google that failed.
// Also empties recycle-bin items older than 30 days.

export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = env("CRON_SECRET");
  if (secret.length < 16) return false;
  const given = request.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!env("CRON_SECRET")) {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server" }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const started = Date.now();
  const summary = await runScheduledSync({ deadline: started + 45_000 });
  // The recycle bin keeps deleted items for 30 days (stage 5b).
  const purged = await purgeExpired().catch(() => null);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  console.info(`[google-calendar] cron ${JSON.stringify(summary)} in ${Date.now() - started}ms`);
  return NextResponse.json({ ok: true, ...summary, purged, ms: Date.now() - started });
}

export const GET = handle;
export const POST = handle;
