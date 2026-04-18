"use client";

// Botón "Inscribirme" del detalle de torneo. Client Component porque:
//   - Maneja loading / error / success state localmente.
//   - Muestra toasts via useToast.
//   - Redirige con router.push tras éxito.
//
// Flujo por estado:
//   - Sin sesión        → Link a /auth/login?callbackUrl=/torneo/{id}
//   - Con sesión + OK   → POST /api/v1/torneos/:id/inscribir → toast +
//                         router.refresh (para re-fetch del page server)
//   - Balance insuficiente → toast con CTA a /wallet (no dispara POST)
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui";

interface InscribirButtonProps {
  torneoId: string;
  entradaLukas: number;
  hasSession: boolean;
  balance: number | null; /* null cuando no hay sesión */
  urgent: boolean; /* estilo critical rojo si true */
  label?: string; /* default: "🎯 Inscribirme por X 🪙" */
}

export function InscribirButton({
  torneoId,
  entradaLukas,
  hasSession,
  balance,
  urgent,
  label,
}: InscribirButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const texto =
    label ??
    (urgent
      ? `🔥 Inscribirme por ${entradaLukas} 🪙`
      : `🎯 Inscribirme por ${entradaLukas} 🪙`);

  // Sin sesión — render como Link directo
  if (!hasSession) {
    return (
      <Link
        href={`/auth/login?callbackUrl=${encodeURIComponent(`/torneo/${torneoId}`)}`}
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

  // Con sesión pero balance insuficiente
  const balanceInsuficiente =
    balance !== null && balance < entradaLukas;

  async function handleClick() {
    if (balanceInsuficiente) {
      toast.show(
        `No te alcanzan los Lukas · Te faltan ${entradaLukas - (balance ?? 0)}. Compra más en /wallet.`,
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/torneos/${torneoId}/inscribir`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          payload?.error?.message ?? "No se pudo completar la inscripción.";
        toast.show(`❌ ${msg}`);
        setLoading(false);
        return;
      }
      toast.show("✅ Inscripción exitosa. Armá tu combinada en breve.");
      // router.refresh re-ejecuta el server component del detalle (actualiza
      // balance mostrado, totalInscritos, etc.).
      router.refresh();
    } catch (err) {
      toast.show(
        "❌ Error de red al inscribirte. Intenta de nuevo en un momento.",
      );
      setLoading(false);
    }
  }

  return (
    <Button
      variant={urgent ? "primary" : "primary"}
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
