import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/auth";
import { connectGoogleAccount } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const partner = await requirePartner();
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/calendar?google_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // The partner who started the flow must match the one finishing it -
  // guards against a forged callback hijacking a different partner's
  // Google connection.
  if (!code || state !== partner.id) {
    return NextResponse.redirect(
      new URL("/calendar?google_error=state_mismatch", request.url)
    );
  }

  try {
    await connectGoogleAccount(partner.id, code);
  } catch {
    return NextResponse.redirect(
      new URL("/calendar?google_error=connect_failed", request.url)
    );
  }

  return NextResponse.redirect(new URL("/calendar?google_connected=1", request.url));
}
