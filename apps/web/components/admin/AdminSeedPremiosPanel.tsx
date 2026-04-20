"use client";

// AdminSeedPremiosPanel — Hotfix #9.
//
// Botón para disparar `POST /api/v1/admin/seed/premios` desde el panel admin,
// con visualización del status actual (GET status). Permite sembrar el
// catálogo en producción con un click sin depender de Railway CLI.
//
// Pattern: authedFetch (§14) — cookies + credentials consistentes.

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";

interface StatusPayload {
  totalPremios: number;
  conStock: number;
  porCategoria: Record<string, number>;
  catalogoEsperado: number;
  faltaSembrar: boolean;
}

interface SeedPayload {
  creados: number;
  actualizados: number;
  totalCatalogo: number;
  totalEnBD: number;
  ejecutadoEn: string;
}

export function AdminSeedPremiosPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [lastSeed, setLastSeed] = useState<SeedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/seed/premios/status");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setStatus(json.data as StatusPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function sembrar() {
    setSeeding(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/seed/premios", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setLastSeed(json.data as SeedPayload);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sembrar catálogo.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <section className="mt-6 rounded-md border border-light bg-card p-4 shadow-sm md:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.02em] text-dark">
            🎁 Catálogo de premios
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-d">
            Siembra idempotente del catálogo MVP (25 premios). Seguro re-correrlo.
          </p>
        </div>
        <button
          type="button"
          onClick={sembrar}
          disabled={seeding || loadingStatus}
          className="shrink-0 rounded-sm bg-brand-gold px-4 py-2 text-[13px] font-bold text-black shadow-gold-btn transition hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {seeding ? "Sembrando..." : "Sembrar catálogo"}
        </button>
      </header>

      {loadingStatus && (
        <p className="text-[13px] text-muted-d">Cargando status…</p>
      )}

      {status && (
        <div className="grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
          <div className="rounded-sm bg-subtle p-2">
            <p className="text-[11px] uppercase text-muted-d">En BD</p>
            <p className="font-display text-lg font-bold text-dark">
              {status.totalPremios} / {status.catalogoEsperado}
            </p>
          </div>
          <div className="rounded-sm bg-subtle p-2">
            <p className="text-[11px] uppercase text-muted-d">Con stock</p>
            <p className="font-display text-lg font-bold text-dark">
              {status.conStock}
            </p>
          </div>
          <div className="rounded-sm bg-subtle p-2 col-span-2">
            <p className="text-[11px] uppercase text-muted-d">Por categoría</p>
            <p className="text-[12px] text-body">
              {Object.entries(status.porCategoria)
                .map(([cat, n]) => `${cat}: ${n}`)
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {status?.faltaSembrar && (
        <div className="mt-3 rounded-sm border border-urgent-high bg-urgent-high-bg px-3 py-2 text-[12px] text-dark">
          ⚠️ El catálogo está incompleto (BD: {status.totalPremios}, esperado:{" "}
          {status.catalogoEsperado}). Clic en <strong>Sembrar catálogo</strong>.
        </div>
      )}

      {lastSeed && (
        <div className="mt-3 rounded-sm border border-pred-correct bg-pred-correct-bg px-3 py-2 text-[12px] text-dark">
          ✓ Último sembrado — creados: <strong>{lastSeed.creados}</strong>,
          actualizados: <strong>{lastSeed.actualizados}</strong>, total en BD:{" "}
          <strong>{lastSeed.totalEnBD}</strong>.
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-sm border border-urgent-critical bg-urgent-critical-bg px-3 py-2 text-[12px] text-dark">
          ⛔ {error}
        </div>
      )}
    </section>
  );
}
