import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ authenticated: await requireSession() });
}
