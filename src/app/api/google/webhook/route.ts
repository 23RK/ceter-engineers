import { after, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { accountForNotification, syncAccount } from "@/lib/google/calendar-sync";

// Google Calendar push notifications (events.watch, SPEC §2.2). Google only
// says "something changed in this calendar"; the change itself is read with
// the incremental sync. Every notification carries the channel id and the
// secret token we gave Google when opening the channel - anything else is
// ignored. Always answers 200 quickly (Google retries on errors).

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token");
  const state = request.headers.get("x-goog-resource-state");
  if (!channelId || !token) return new Response(null, { status: 204 });

  const userId = await accountForNotification(channelId, token);
  if (!userId) {
    console.warn(`[google-calendar] notification for an unknown channel ignored`);
    return new Response(null, { status: 204 });
  }
  // "sync" is only Google confirming that the channel is open.
  if (state !== "sync") {
    after(async () => {
      await syncAccount(userId);
      revalidatePath("/calendar");
      revalidatePath("/dashboard");
    });
  }
  return new Response(null, { status: 204 });
}
