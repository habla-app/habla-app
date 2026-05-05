"use client";
// VincularEventIdModal — Lote V fase V.5.
//
// Modal con createPortal(document.body) (regla 10) para vincular
// manualmente el eventId externo de una casa a un partido. El admin pega
// la URL del partido en la casa y el endpoint extrae el id con regex.
//
// Cero clases Tailwind utility (regla 30) — inline styles con tokens
// `var(--*)` y clases nominadas existentes (`btn`, `btn-ghost`, etc).
// Patrón heredado del Lote U (EliminarCuentaButton, YapeCapturaBanner).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

// Lote V.11: Stake removido del motor — quedan 6 casas API-only.
// Este componente queda como vinculación manual opcional (el scraper API
// descubre eventos por matching de equipos automáticamente, así que el
// modal es solo un fallback histórico para admin).
type CasaSlug =
  | "apuesta_total"
  | "coolbet"
  | "doradobet"
  | "betano"
  | "inkabet"
  | "te_apuesto";

interface Props {
  partidoId: string;
  casa: CasaSlug;
  casaLabel: string;
  /** Si ya hay un eventId, mostrarlo como hint. */
  eventIdActual?: string | null;
  /** Trigger custom (botón). Por defecto, "Vincular manualmente" o "Editar". */
  triggerLabel?: string;
}

const PLACEHOLDERS: Record<CasaSlug, string> = {
  apuesta_total:
    "https://www.apuestatotal.com/.../partido/123456789012345",
  coolbet: "https://www.coolbet.pe/en/sports/match/2528144",
  doradobet: "https://doradobet.com/deportes/.../partido/123456",
  betano: "https://www.betano.pe/cuotas-de-partido/.../84146293/",
  inkabet: "https://www.inkabet.pe/...?eventId=f-r0f9JVh-c0WyAMylSZtvtA",
  te_apuesto: "ID numérico del partido (ej. 12345)",
};

export function VincularEventIdModal({
  partidoId,
  casa,
  casaLabel,
  eventIdActual,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        setOpen(false);
        setError(null);
      }
    }
    document.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, submitting]);

  function abrir() {
    setError(null);
    setUrl("");
    setOpen(true);
  }
  function cerrar() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  async function ejecutar() {
    if (!url.trim()) {
      setError("Pegá la URL del partido en la casa.");
      return;
    }
    setError(null);
    setSubmitting(true);

    let resp: Response;
    try {
      resp = await authedFetch(
        `/api/v1/admin/partidos/${partidoId}/event-ids`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ casa, url: url.trim() }),
        },
      );
    } catch {
      setSubmitting(false);
      setError("Error de red. Probá de nuevo.");
      return;
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      const msg =
        (data?.error?.message as string | undefined) ??
        "No pudimos vincular el evento. Verificá la URL.";
      setSubmitting(false);
      setError(msg);
      return;
    }

    setSubmitting(false);
    setOpen(false);
    setUrl("");
    router.refresh();
  }

  const label = triggerLabel ?? (eventIdActual ? "editar" : "vincular manualmente");

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="btn btn-ghost btn-xs"
        style={{ fontSize: 11 }}
      >
        {label}
      </button>

      {open && mounted
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Vincular ${casaLabel}`}
              onClick={cerrar}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "rgba(8, 18, 47, 0.65)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 12,
                  width: "100%",
                  maxWidth: 540,
                  padding: 24,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "var(--text-dark)",
                    marginBottom: 6,
                  }}
                >
                  Vincular {casaLabel} manualmente
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted-d)",
                    marginBottom: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Pegá la URL del partido en {casaLabel}. El sistema extrae el
                  ID con su regex específica y dispara una captura inmediata.
                </p>

                {eventIdActual ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted-d)",
                      marginBottom: 8,
                      fontFamily: "monospace",
                    }}
                  >
                    Event ID actual: <strong>{eventIdActual}</strong>
                  </div>
                ) : null}

                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted-d)",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    marginBottom: 6,
                  }}
                >
                  URL del partido
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoFocus
                  disabled={submitting}
                  placeholder={PLACEHOLDERS[casa]}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text-dark)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 6,
                    background: "var(--bg-page)",
                    marginBottom: 6,
                  }}
                  aria-label="URL del partido"
                />

                {error ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--pred-wrong)",
                      fontWeight: 600,
                      marginBottom: 10,
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={cerrar}
                    disabled={submitting}
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void ejecutar()}
                    disabled={submitting || !url.trim()}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: "var(--blue-main)",
                      color: "#fff",
                      fontWeight: 800,
                      opacity: submitting || !url.trim() ? 0.6 : 1,
                      cursor:
                        submitting || !url.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting ? "Vinculando…" : "Vincular y capturar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
