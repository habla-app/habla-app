"use client";

// PrediccionForm — formulario de los 5 mercados de Liga Habla! (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// 5 mercados oficiales del modelo v3.1:
//   1. Resultado (1X2)        — 3 pts
//   2. Ambos anotan (BTTS)    — 2 pts
//   3. Más de 2.5 goles       — 2 pts
//   4. Tarjeta roja           — 6 pts
//   5. Marcador exacto        — 8 pts
//
// El form es controlado: prefill con `prediccionExistente` si el usuario ya
// envió una predicción para este torneo. Se deshabilita si el partido ya
// arrancó (server pasa `disabled=true` cuando `cierreAt <= now`).
//
// Submit dispara POST /api/v1/tickets (existente Lote 0/5). El backend
// detecta el placeholder y actualiza en lugar de crear, así que el flujo
// "primer envío + edición" funciona sin nuevos endpoints.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authedFetch } from "@/lib/api-client";
import { MarketRow } from "./MarketRow";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export interface PrediccionInicial {
  predResultado: "LOCAL" | "EMPATE" | "VISITA";
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

interface PrediccionFormProps {
  torneoId: string;
  partidoSlug: string;
  equipoLocal: string;
  equipoVisita: string;
  prediccionInicial?: PrediccionInicial | null;
  /** Si true, el form queda read-only (cierreAt pasó o partido EN_VIVO). */
  disabled?: boolean;
  /** Si true, el usuario ya envió una predicción y este form actúa como
   *  edición — el CTA cambia a "✅ Actualizar predicción". */
  yaEnviada?: boolean;
}

const DEFAULT: PrediccionInicial = {
  predResultado: "LOCAL",
  predBtts: false,
  predMas25: false,
  predTarjetaRoja: false,
  predMarcadorLocal: 0,
  predMarcadorVisita: 0,
};

export function PrediccionForm({
  torneoId,
  partidoSlug,
  equipoLocal,
  equipoVisita,
  prediccionInicial,
  disabled = false,
  yaEnviada = false,
}: PrediccionFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pred, setPred] = useState<PrediccionInicial>(
    prediccionInicial ?? DEFAULT,
  );
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function enviar() {
    if (disabled || enviando) return;
    setEnviando(true);
    try {
      const resp = await authedFetch("/api/v1/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          torneoId,
          ...pred,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.show(
          `❌ ${json?.error?.message ?? "No pudimos guardar tu predicción"}`,
        );
        return;
      }
      toast.show(
        yaEnviada
          ? "✅ Predicción actualizada"
          : "🏆 ¡Predicción enviada! Suerte con los puntos.",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.show("❌ Error de red. Reintentá en unos segundos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className="space-y-4"
    >
      <MarketRow
        label="Resultado final"
        pts={3}
        variant="triple"
        value={pred.predResultado}
        disabled={disabled}
        onChange={(v) => setPred({ ...pred, predResultado: v })}
        options={[
          { value: "LOCAL", label: cortar(equipoLocal) },
          { value: "EMPATE", label: "Empate" },
          { value: "VISITA", label: cortar(equipoVisita) },
        ]}
      />
      <MarketRow
        label="Ambos anotan"
        pts={2}
        variant="binary"
        value={pred.predBtts}
        disabled={disabled}
        onChange={(v) => setPred({ ...pred, predBtts: v })}
        options={[
          { value: true, label: "Sí" },
          { value: false, label: "No" },
        ]}
      />
      <MarketRow
        label="Más de 2.5 goles"
        pts={2}
        variant="binary"
        value={pred.predMas25}
        disabled={disabled}
        onChange={(v) => setPred({ ...pred, predMas25: v })}
        options={[
          { value: true, label: "Más" },
          { value: false, label: "Menos" },
        ]}
      />
      <MarketRow
        label="Tarjeta roja"
        pts={6}
        variant="binary"
        value={pred.predTarjetaRoja}
        disabled={disabled}
        onChange={(v) => setPred({ ...pred, predTarjetaRoja: v })}
        options={[
          { value: true, label: "Sí" },
          { value: false, label: "No" },
        ]}
      />
      <MarketRow
        label="Marcador exacto"
        pts={8}
        variant="input"
        local={pred.predMarcadorLocal}
        visita={pred.predMarcadorVisita}
        disabled={disabled}
        onChange={(local, visita) =>
          setPred({
            ...pred,
            predMarcadorLocal: local,
            predMarcadorVisita: visita,
          })
        }
      />

      {/* Submit visible inline para usuarios que prefieren botón cerca del
          form (el sticky CTA del shell también dispara este submit via id). */}
      <button
        id="prediccion-submit"
        type="submit"
        disabled={disabled || enviando}
        className="sr-only"
        aria-hidden
      >
        Enviar predicción
      </button>

      {/* Botón inline visible (mobile) */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="xl"
          disabled={disabled || enviando}
        >
          {enviando
            ? "Enviando…"
            : disabled
              ? "Predicciones cerradas"
              : yaEnviada
                ? "✅ Actualizar predicción"
                : "🏆 Enviar mi predicción"}
        </Button>
      </div>

      {/* Helper para que el partidoSlug no quede unused — útil para
          analytics fire-and-forget si se agrega tracking acá en el futuro. */}
      <input type="hidden" name="partidoSlug" value={partidoSlug} />
    </form>
  );
}

function cortar(nombre: string): string {
  if (nombre.length <= 8) return nombre;
  return `${nombre.slice(0, 8)}.`;
}
