"use client";
// AccionesGlobalesPanel — Lote V fase V.5.
//
// Panel client en /admin/motor-cuotas con:
//   - Botón [Forzar refresh global] → POST /api/v1/admin/motor-cuotas/refresh-global
//   - Selector + botón [Reactivar scraper bloqueado] → POST /api/v1/admin/motor-cuotas/scrapers/[casa]/reactivar

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

interface CasaBloqueada {
  casa: string;
  label: string;
}

interface Props {
  casasBloqueadas: CasaBloqueada[];
}

export function AccionesGlobalesPanel({ casasBloqueadas }: Props) {
  const router = useRouter();
  const [submittingGlobal, setSubmittingGlobal] = useState(false);
  const [resultadoGlobal, setResultadoGlobal] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const [casaReactivar, setCasaReactivar] = useState<string>(
    casasBloqueadas[0]?.casa ?? "",
  );
  const [submittingReactivar, setSubmittingReactivar] = useState(false);
  const [errorReactivar, setErrorReactivar] = useState<string | null>(null);

  async function refreshGlobal() {
    if (submittingGlobal) return;
    setSubmittingGlobal(true);
    setErrorGlobal(null);
    setResultadoGlobal(null);
    try {
      const resp = await authedFetch(
        "/api/v1/admin/motor-cuotas/refresh-global",
        { method: "POST" },
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        setErrorGlobal(
          (data?.error?.message as string | undefined) ??
            "No se pudo encolar el refresh global.",
        );
      } else {
        const partidos = data?.partidosProcesados ?? 0;
        const jobs = data?.jobsTotales ?? 0;
        setResultadoGlobal(`${partidos} partidos · ${jobs} jobs encolados`);
      }
    } catch {
      setErrorGlobal("Error de red.");
    }
    setSubmittingGlobal(false);
    router.refresh();
  }

  async function reactivar() {
    if (submittingReactivar || !casaReactivar) return;
    setSubmittingReactivar(true);
    setErrorReactivar(null);
    try {
      const resp = await authedFetch(
        `/api/v1/admin/motor-cuotas/scrapers/${casaReactivar}/reactivar`,
        { method: "POST" },
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setErrorReactivar(
          (data?.error?.message as string | undefined) ??
            "No se pudo reactivar el scraper.",
        );
      }
    } catch {
      setErrorReactivar("Error de red.");
    }
    setSubmittingReactivar(false);
    router.refresh();
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "var(--text-dark)",
            marginBottom: 8,
          }}
        >
          ↻ Forzar refresh global
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted-d)",
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          Encola los 7 scrapers para todos los partidos con Filtro 1 ON.
          Tiene rate limit interno (skip si OK reciente).
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => void refreshGlobal()}
            disabled={submittingGlobal}
            className="btn btn-ghost btn-sm"
          >
            {submittingGlobal ? "Encolando…" : "Forzar refresh global"}
          </button>
          {resultadoGlobal ? (
            <span style={{ fontSize: 11, color: "var(--pred-right)" }}>
              {resultadoGlobal}
            </span>
          ) : null}
          {errorGlobal ? (
            <span style={{ fontSize: 11, color: "var(--pred-wrong)" }}>
              {errorGlobal}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "var(--text-dark)",
            marginBottom: 8,
          }}
        >
          🟢 Reactivar scraper bloqueado
        </div>
        {casasBloqueadas.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted-d)",
              lineHeight: 1.5,
            }}
          >
            No hay scrapers bloqueados.
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted-d)",
                marginBottom: 10,
                lineHeight: 1.5,
              }}
            >
              Quita el estado BLOQUEADO de un scraper y resetea el contador
              de errores. Usar solo si la casa volvió a operar.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <select
                className="admin-filter-select"
                value={casaReactivar}
                onChange={(e) => setCasaReactivar(e.target.value)}
                disabled={submittingReactivar}
                style={{ minWidth: 140 }}
              >
                {casasBloqueadas.map((c) => (
                  <option key={c.casa} value={c.casa}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void reactivar()}
                disabled={submittingReactivar || !casaReactivar}
                className="btn btn-ghost btn-sm"
              >
                {submittingReactivar ? "Reactivando…" : "Reactivar"}
              </button>
              {errorReactivar ? (
                <span style={{ fontSize: 11, color: "var(--pred-wrong)" }}>
                  {errorReactivar}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
