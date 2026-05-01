"use client";

// CostoForm — modal para agregar/editar costo operativo. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";
import {
  CATEGORIAS_COSTO_PREDEFINIDAS,
  LABEL_CATEGORIA,
} from "@/lib/services/finanzas.service";

interface Props {
  mes: string;
  categoriaInicial?: string;
  montoInicial?: number;
  notasIniciales?: string | null;
  onClose: () => void;
}

export function CostoForm({
  mes,
  categoriaInicial,
  montoInicial,
  notasIniciales,
  onClose,
}: Props) {
  const router = useRouter();
  const [categoria, setCategoria] = useState(categoriaInicial ?? "anthropic_api");
  const [montoSoles, setMontoSoles] = useState(montoInicial ?? 0);
  const [notas, setNotas] = useState(notasIniciales ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/finanzas/costos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          categoria,
          montoSoles,
          notas: notas || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-md bg-admin-card-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-admin-card-title text-dark">
          {categoriaInicial ? "Editar costo" : "Nuevo costo"} · {mes}
        </h3>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Categoría</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={!!categoriaInicial}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          >
            {CATEGORIAS_COSTO_PREDEFINIDAS.map((c) => (
              <option key={c} value={c}>
                {LABEL_CATEGORIA[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Monto en soles</span>
          <input
            type="number"
            value={montoSoles}
            onChange={(e) => setMontoSoles(Number(e.target.value))}
            min={0}
            step={1}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
        </label>
        <label className="mb-4 block">
          <span className="text-admin-label text-muted-d">Notas (opcional)</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
        </label>
        {error && (
          <p className="mb-3 rounded-sm bg-status-red-bg px-3 py-2 text-admin-meta text-status-red-text">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-sm border border-admin-table-border px-3 py-1.5 text-admin-meta text-muted-d hover:text-dark"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
