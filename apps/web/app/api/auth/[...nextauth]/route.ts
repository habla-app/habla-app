// NextAuth API route handler
// TODO: Sprint 1 - Configurar providers (Google + Email)
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Auth not configured yet" }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ message: "Auth not configured yet" }, { status: 501 });
}
