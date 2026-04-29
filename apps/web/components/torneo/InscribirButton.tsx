"use client";

// Botón "Predecir gratis" del detalle de torneo. Lote 2 (Abr 2026): la
// inscripción ya no descuenta saldo — el botón sólo crea el ticket
// placeholder y refresca el detalle. Sin sesión redirige a /auth/signin.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";

interface InscribirButtonProps {
  torneoId: string;
  hasSession: boolean;
  /** estilo critical rojo si true (queda <15 min al cierre). */
  urgent: boolean;
  label?: string; /* default: "🎯 Predecir gratis" */
}

export function InscribirButton({
  torneoId,
  hasSession,
  urgent,
  label,
}: InscribirButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const texto =
    label ?? (urgent ? "🔥 Predecir gratis" : "🎯 Predecir gratis");

  if (!hasSession) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(`/torneo/${torneoId}`)}`}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] transition-all duration-150 ${
          urgent
            ? "bg-urgent-critical text-white shadow-urgent-btn hover:-translate-y-px hover:bg-urgent-critical-hover"
            : "bg-brand-gold text-black shadow-gold-cta hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
        }`}
      >
        {texto}
      </Link>
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      const res = await authedFetch(
        `/api/v1/torneos/${torneoId}/inscribir`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          payload?.error?.message ?? "No se pudo completar la inscripción.";
        toast.show(`❌ ${msg}`);
        setLoading(false);
        return;
      }
      toast.show("✅ Inscripción exitosa. Armá tu combinada en breve.");
      router.refresh();
    } catch {
      toast.show(
        "❌ Error de red al inscribirte. Intenta de nuevo en un momento.",
      );
      setLoading(false);
    }
  }

  return (
    <Button
      variant="primary"
      size="xl"
      onClick={handleClick}
      disabled={loading}
      className={
        urgent
          ? "bg-urgent-critical text-white shadow-urgent-btn hover:bg-urgent-critical-hover"
          : ""
      }
    >
      {loading ? "Inscribiendo…" : texto}
    </Button>
  );
}
