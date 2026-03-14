import { PreferenceService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const preferenceService = new PreferenceService();

export async function GET() {
  const data = await preferenceService.getPreferences();
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Expected a JSON object payload");
    }
    const data = await preferenceService.updatePreferences(body);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update preferences"
      },
      { status: 400 }
    );
  }
}
