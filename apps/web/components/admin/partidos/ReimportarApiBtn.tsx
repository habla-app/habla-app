"use client";

// ReimportarApiBtn — Lote O (May 2026): botón "Re-importar API-Football" del
// topbar de /admin/partidos. Mockup `docs/habla-mockup-v3.2.html` línea 5294.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

export function ReimportarApiBtn() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function importar() {
    if (cargando) return;
    setCargando(true);
    try {
      await authedFetch("/api/v1/admin/partidos/importar", { method: "POST" });
      router.refresh();
    } catch {
      // fail-soft: el admin verá que no hay refresh
    } finally {
      setCargando(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={importar}
      disabled={cargando}
    >
      {cargando ? "Importando..." : "⟳ Re-importar API-Football"}
    </button>
  );
}
