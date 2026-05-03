"use client";
// EliminarCuentaButton — Lote U v3.2.
//
// Reemplaza al link viejo `/perfil/eliminar` (page legacy email-token).
// Modelo: botón rojo en perfil → modal de confirmación → input "ELIMINAR"
// + click "Eliminar cuenta" → POST /api/v1/usuarios/me/eliminar/inmediato
// → signOut redirect:false + hard reload a /.
//
// El endpoint inmediato decide hard vs soft delete según actividad
// (tickets / canjes). Devuelve {ok:true, modo:"hard"|"soft"}.
//
// Cero clases Tailwind utility — el modal usa inline styles con tokens
// `var(--*)` ya definidos por mockup-styles.css. No usa el componente
// `<Modal>` legacy (que sí trae Tailwind) para mantener este componente
// 100% compliant con la regla 30 de CLAUDE.md ("Cero clases Tailwind
// utility en los archivos tocados").

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";

const CONFIRMACION_LITERAL = "ELIMINAR";

export function EliminarCuentaButton() {
  const [open, setOpen] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setConfirmacion("");
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
    setConfirmacion("");
    setOpen(true);
  }

  function cerrar() {
    if (submitting) return;
    setOpen(false);
    setError(null);
    setConfirmacion("");
  }

  async function ejecutar() {
    if (confirmacion !== CONFIRMACION_LITERAL) {
      setError(`Tenés que escribir ${CONFIRMACION_LITERAL} para confirmar.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    let resp: Response;
    try {
      resp = await fetch("/api/v1/usuarios/me/eliminar/inmediato", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: CONFIRMACION_LITERAL }),
      });
    } catch {
      setSubmitting(false);
      setError("Error de red. Probá de nuevo.");
      return;
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      const msg =
        (data?.error?.message as string | undefined) ??
        "No pudimos eliminar la cuenta. Contactá soporte.";
      setSubmitting(false);
      setError(msg);
      return;
    }

    // Limpieza de sesión + redirect a home. La cookie quedó apuntando a un
    // usuario anonimizado (soft) o inexistente (hard) — la nueva sesión
    // arrancará como visitante.
    try {
      await signOut({ redirect: false });
    } catch {
      /* noop — pase lo que pase, hacemos hard reload abajo */
    }
    window.location.href = "/";
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="btn btn-ghost btn-sm"
        style={{ justifyContent: "flex-start", color: "var(--pred-wrong)" }}
      >
        🗑 Eliminar mi cuenta
      </button>

      {open && mounted
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Eliminar mi cuenta"
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
                  maxWidth: 480,
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
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--pred-wrong)" }}>⚠</span>
                  Eliminar mi cuenta
                </div>

                <p style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 14 }}>
                  Esta acción es <strong>permanente</strong>. Vamos a eliminar tus datos personales (nombre, email, ubicación) y cerrar tu sesión. Tus combinadas quedarán anonimizadas en el ranking histórico.
                </p>

                <p style={{ fontSize: 12, color: "var(--text-muted-d)", marginBottom: 14 }}>
                  Si tenés una suscripción Socios activa, cancelala primero desde tu hub para evitar el próximo cobro.
                </p>

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
                  Escribí <strong style={{ color: "var(--text-dark)" }}>{CONFIRMACION_LITERAL}</strong> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  autoFocus
                  disabled={submitting}
                  placeholder={CONFIRMACION_LITERAL}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: 14,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    color: "var(--text-dark)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 6,
                    background: "var(--bg-page)",
                    marginBottom: 6,
                  }}
                  aria-label="Confirmación literal"
                />

                {error ? (
                  <div style={{ fontSize: 12, color: "var(--pred-wrong)", fontWeight: 600, marginBottom: 10 }}>
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
                    disabled={submitting || confirmacion !== CONFIRMACION_LITERAL}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: "var(--pred-wrong)",
                      color: "#fff",
                      fontWeight: 800,
                      opacity:
                        submitting || confirmacion !== CONFIRMACION_LITERAL
                          ? 0.6
                          : 1,
                      cursor:
                        submitting || confirmacion !== CONFIRMACION_LITERAL
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {submitting ? "Eliminando…" : "Eliminar cuenta"}
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
