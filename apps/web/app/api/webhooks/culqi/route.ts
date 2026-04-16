// Webhook de Culqi para confirmacion de pago
// TODO: Sprint 2 - Implementar webhook handler
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Webhook not configured yet" }, { status: 501 });
}
