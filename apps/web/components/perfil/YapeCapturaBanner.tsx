"use client";
// YapeCapturaBanner — Lote U v3.2.
//
// Banner gold persistente en /perfil para los Top 10 ganadores de la Liga
// Habla! que aún no registraron su yapeNumero. Sin yapeNumero no se les
// puede pagar el premio. La regla 28 de CLAUDE.md aclara que el premio es
// publicitario, datos mínimos (nombre + yapeNumero, sin DNI).
//
// El banner se renderiza desde /perfil cuando:
//   - el usuario está en Top 10 del mes en curso (props.posicion <= 10)
//   - O ganó algún Top 10 previo cerrado (props.posicion <= 10 con cerrado=true)
//   - Y `yapeNumero === null`.
//
// Click en "Registrar Yape" abre un modal con:
//   - input numérico para el celular (auto-formato a 9 dígitos)
//   - validación cliente: regex /^9\d{8}$/
//   - submit → PATCH /api/v1/usuarios/me/yape
//   - éxito → refresh()  (server vuelve a leer yapeNumero y oculta el banner)
//
// Cero clases Tailwind utility — uso inline-styles con tokens var(--*).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Props {
  /** Posición del usuario en el ranking actual (o el último cerrado). */
  posicion: number;
  /** Mes al que corresponde la posición — texto literal, ej. "Mayo 2026". */
  nombreMes: string;
  /** Si el premio ya está confirmado (mes cerrado). Cambia el copy. */
  premioConfirmado: boolean;
}

const YAPE_REGEX = /^9\d{8}$/;

export function YapeCapturaBanner({
  posicion,
  nombreMes,
  premioConfirmado,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        // Cierre inline (mismo efecto que cerrar()) para evitar dep
        // estable en useEffect.
        setOpen(false);
        setError(null);
        setValor("");
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
    setValor("");
    setOpen(true);
  }

  function cerrar() {
    if (submitting) return;
    setOpen(false);
    setError(null);
    setValor("");
  }

  function onChangeValor(e: React.ChangeEvent<HTMLInputElement>) {
    // Aceptamos solo dígitos, max 9.
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    setValor(digits);
  }

  async function guardar() {
    setError(null);
    if (!YAPE_REGEX.test(valor)) {
      setError("Tiene que ser un celular peruano de 9 dígitos que empieza con 9.");
      return;
    }
    setSubmitting(true);

    let resp: Response;
    try {
      resp = await fetch("/api/v1/usuarios/me/yape", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yapeNumero: valor }),
      });
    } catch {
      setSubmitting(false);
      setError("Error de red. Probá de nuevo.");
      return;
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      const msg =
        (data?.error?.message as string | undefined) ?? "No se pudo guardar.";
      setSubmitting(false);
      setError(msg);
      return;
    }

    setOpen(false);
    setSubmitting(false);
    router.refresh();
  }

  const titulo = premioConfirmado
    ? `🏆 Ganaste S/ del Top 10 · ${nombreMes}`
    : `🏆 Vas Top 10 · ${nombreMes}`;
  const subtitulo = premioConfirmado
    ? "Para cobrar tu premio necesitamos tu Yape. Lo pagamos en las próximas 48h."
    : "Si terminás en el Top 10 al cierre, te pagamos por Yape. Registralo ahora así no te demoramos cuando ganes.";

  return (
    <>
      <div
        style={{
          background: "linear-gradient(135deg, #FFFAEB, #fff)",
          border: "1px solid var(--gold)",
          borderRadius: 12,
          padding: 18,
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
        role="region"
        aria-label="Capturar número Yape"
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "var(--text-dark)",
              marginBottom: 4,
            }}
          >
            {titulo} · #{posicion}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.5 }}>
            {subtitulo}
          </div>
        </div>
        <button
          type="button"
          onClick={abrir}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0 }}
        >
          Registrar Yape
        </button>
      </div>

      {open && mounted
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Registrar número Yape"
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
                  maxWidth: 420,
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
                    marginBottom: 4,
                  }}
                >
                  📱 Registrar número Yape
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted-d)", marginBottom: 14 }}>
                  Solo necesitamos tu celular Yape. No pedimos DNI ni cuenta bancaria.
                </p>

                <label
                  htmlFor="yape-numero"
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
                  Celular (9 dígitos, empieza con 9)
                </label>
                <input
                  id="yape-numero"
                  type="tel"
                  inputMode="numeric"
                  value={valor}
                  onChange={onChangeValor}
                  autoFocus
                  disabled={submitting}
                  placeholder="9XXXXXXXX"
                  maxLength={9}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 16,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    color: "var(--text-dark)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 6,
                    background: "var(--bg-page)",
                    marginBottom: 6,
                    letterSpacing: "0.03em",
                  }}
                  aria-invalid={!!error}
                />

                {error ? (
                  <div style={{ fontSize: 12, color: "var(--pred-wrong)", fontWeight: 600, marginBottom: 6 }}>
                    {error}
                  </div>
                ) : null}

                <p style={{ fontSize: 11, color: "var(--text-muted-d)", marginTop: 8, marginBottom: 14, lineHeight: 1.5 }}>
                  Apuesta responsable. Solo +18. Línea Tugar (gratuita): 0800-19009.
                </p>

                <div style={{ display: "flex", gap: 8 }}>
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
                    onClick={() => void guardar()}
                    disabled={submitting || !YAPE_REGEX.test(valor)}
                    className="btn btn-primary btn-sm"
                    style={{
                      flex: 1,
                      opacity: submitting || !YAPE_REGEX.test(valor) ? 0.6 : 1,
                      cursor:
                        submitting || !YAPE_REGEX.test(valor)
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {submitting ? "Guardando…" : "Guardar"}
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
