"use client";

// PostPagoVerificando — modo "verificando" del post-pago (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.
//
// Si el usuario llega a /premium/exito antes de que el webhook de OpenPay
// haya activado la suscripción, mostramos un spinner y polleamos cada 3s
// el endpoint `/api/v1/suscripciones/me`. Cuando detectamos `activa=true`,
// recargamos la página para que el server component renderice la vista
// final con el deep link al Channel.
//
// Timeout 60s → mensaje fallback con CTA a soporte. El user puede recargar
// manualmente si su email confirma el cargo.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60_000;

export function PostPagoVerificando() {
  const router = useRouter();
  const [vencidoTimeout, setVencidoTimeout] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelado) return;
      if (Date.now() - startedAt > TIMEOUT_MS) {
        setVencidoTimeout(true);
        return;
      }
      try {
        const res = await authedFetch("/api/v1/suscripciones/me");
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.activa === true) {
            router.refresh();
            return;
          }
        }
      } catch {
        /* ignorar — reintentamos */
      }
      if (!cancelado) {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelado = true;
    };
  }, [router]);

  if (vencidoTimeout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center">
        <div
          aria-hidden
          className="text-5xl"
        >
          ⏳
        </div>
        <h1 className="font-display text-display-md font-extrabold text-dark">
          Tu pago se está procesando
        </h1>
        <p className="max-w-[320px] text-body-sm leading-snug text-body">
          La acreditación está tomando más de lo normal. Cuando se confirme te
          enviaremos un email con el link al Channel. Si tu tarjeta fue
          cobrada, no hay nada más que hacer ahora.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="touch-target rounded-md bg-brand-gold px-5 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
          >
            Recargar
          </button>
          <Link
            href="/ayuda/faq"
            className="touch-target rounded-md border-[1.5px] border-strong bg-transparent px-5 py-3 text-[13px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
          >
            Contactar soporte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center"
    >
      <div
        aria-hidden
        className="h-14 w-14 animate-spin rounded-full border-4 border-light border-t-brand-gold"
      />
      <h1 className="font-display text-display-md font-extrabold text-dark">
        Verificando tu pago
      </h1>
      <p className="max-w-[320px] text-body-sm leading-snug text-body">
        Estamos confirmando con OpenPay que el cargo se acreditó. Esto suele
        tomar menos de 1 minuto. No cierres esta pestaña.
      </p>
    </div>
  );
}
