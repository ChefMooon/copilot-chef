import { PreferenceService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const preferenceService = new PreferenceService();

export async function POST() {
  try {
    const data = await preferenceService.resetPreferences();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reset preferences"
      },
      { status: 400 }
    );
  }
}