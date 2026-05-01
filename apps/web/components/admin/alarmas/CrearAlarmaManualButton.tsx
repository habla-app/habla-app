"use client";

// CrearAlarmaManualButton — modal para crear alarma manual. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

export function CrearAlarmaManualButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [severidad, setSeveridad] = useState<"INFO" | "WARNING" | "CRITICAL">("INFO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/alarmas/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion, severidad }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      setTitulo("");
      setDescripcion("");
      setSeveridad("INFO");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white hover:bg-brand-blue-dark"
      >
        + Alarma manual
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-md bg-admin-card-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-admin-card-title text-dark">Crear alarma manual</h3>
            <label className="mb-3 block">
              <span className="text-admin-label text-muted-d">Título</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                minLength={3}
                maxLength={200}
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              />
            </label>
            <label className="mb-3 block">
              <span className="text-admin-label text-muted-d">Descripción</span>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                minLength={3}
                rows={3}
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              />
            </label>
            <label className="mb-4 block">
              <span className="text-admin-label text-muted-d">Severidad</span>
              <select
                value={severidad}
                onChange={(e) =>
                  setSeveridad(e.target.value as "INFO" | "WARNING" | "CRITICAL")
                }
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              >
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </label>
            {error && (
              <p className="mb-3 rounded-sm bg-status-red-bg px-3 py-2 text-admin-meta text-status-red-text">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                {loading ? "Guardando..." : "Crear"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
