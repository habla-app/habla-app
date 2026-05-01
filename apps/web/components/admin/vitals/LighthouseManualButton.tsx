"use client";

// LighthouseManualButton — botón para correr Lighthouse manual. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

const PRESETS = ["/", "/comunidad", "/premium", "/cuotas", "/blog"] as const;

export function LighthouseManualButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState<string>("/");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispatch() {
    setLoading(true);
    setError(null);
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://hablaplay.com";
    try {
      const res = await authedFetch("/api/v1/admin/vitals/lighthouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${baseUrl}${pathname}`,
          device,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
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
        className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta font-bold text-dark transition-colors hover:bg-subtle"
      >
        ▶ Correr Lighthouse
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-md bg-admin-card-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-admin-card-title text-dark mb-4">
              Correr Lighthouse manual
            </h3>
            <label className="block mb-3">
              <span className="text-admin-label text-muted-d">Ruta</span>
              <select
                value={pathname}
                onChange={(e) => setPathname(e.target.value)}
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              >
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block mb-4">
              <span className="text-admin-label text-muted-d">Device</span>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value as "mobile" | "desktop")}
                className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
              >
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
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
                type="button"
                onClick={dispatch}
                disabled={loading}
                className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white disabled:opacity-50"
              >
                {loading ? "Ejecutando..." : "Ejecutar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
