"use client";

// AlarmasActivasList — lista de alarmas activas con botón desactivar. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlarmaFila } from "@/lib/services/alarmas.service";
import { authedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils/cn";

interface Props {
  alarmas: AlarmaFila[];
}

const SEVERIDAD_BG: Record<string, string> = {
  CRITICAL: "bg-status-red-bg border-status-red",
  WARNING: "bg-status-amber-bg border-status-amber",
  INFO: "bg-admin-card-bg border-admin-table-border",
};

const SEVERIDAD_ICON: Record<string, string> = {
  CRITICAL: "🔴",
  WARNING: "🟡",
  INFO: "🔵",
};

export function AlarmasActivasList({ alarmas }: Props) {
  if (alarmas.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-admin-table-border bg-admin-card-bg p-8 text-center text-admin-body text-muted-d">
        🟢 No hay alarmas activas. Sistema saludable.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {alarmas.map((a) => (
        <AlarmaCard key={a.id} alarma={a} />
      ))}
    </div>
  );
}

function AlarmaCard({ alarma }: { alarma: AlarmaFila }) {
  const router = useRouter();
  const [desactivando, setDesactivando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function desactivar() {
    if (motivo.trim().length < 5) {
      setError("Motivo obligatorio (mínimo 5 caracteres)");
      return;
    }
    setError(null);
    try {
      const res = await authedFetch(`/api/v1/admin/alarmas/${alarma.id}/desactivar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló");
    }
  }

  return (
    <div
      className={cn("rounded-md border p-4", SEVERIDAD_BG[alarma.severidad])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden>{SEVERIDAD_ICON[alarma.severidad]}</span>
            <span className="text-admin-card-title text-dark">{alarma.titulo}</span>
            <span className="rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-d">
              {alarma.tipo}
            </span>
          </div>
          <p className="mt-1.5 text-admin-body text-dark">{alarma.descripcion}</p>
          <p className="mt-1 text-admin-meta text-muted-d">
            Activa desde:{" "}
            {alarma.creadaEn.toLocaleString("es-PE", {
              timeZone: "America/Lima",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div>
          {!desactivando ? (
            <button
              type="button"
              onClick={() => setDesactivando(true)}
              className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta font-bold text-dark hover:bg-subtle"
            >
              Desactivar
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (mín 5 chars)"
                className="rounded-sm border border-admin-table-border bg-admin-card-bg px-2 py-1 text-admin-meta text-dark"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDesactivando(false);
                    setMotivo("");
                    setError(null);
                  }}
                  className="rounded-sm px-2 py-1 text-admin-meta text-muted-d hover:text-dark"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={desactivar}
                  className="rounded-sm bg-status-red px-2 py-1 text-admin-meta font-bold text-white"
                >
                  Confirmar
                </button>
              </div>
              {error && (
                <p className="text-admin-meta text-status-red-text">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
