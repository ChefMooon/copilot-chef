import { PersonaService } from "@copilot-chef/core";
import { NextResponse } from "next/server";

const personaService = new PersonaService();

export async function GET() {
  const data = await personaService.list();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await personaService.create(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create persona",
      },
      { status: 400 }
    );
  }
}
