import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/auth";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const partner = await requirePartner();

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/calendar?google_error=not_configured", request.url)
    );
  }

  return NextResponse.redirect(getGoogleAuthUrl(partner.id));
}
