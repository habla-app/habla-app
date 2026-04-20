// AdminCanjesPanel — listado de canjes + acciones. Sub-Sprint 6.
"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";

type EstadoCanje =
  | "PENDIENTE"
  | "PROCESANDO"
  | "ENVIADO"
  | "ENTREGADO"
  | "CANCELADO";

interface CanjeAdmin {
  id: string;
  usuarioId: string;
  premioId: string;
  lukasUsados: number;
  estado: EstadoCanje;
  direccion: Record<string, unknown> | null;
  creadoEn: string;
  premio: {
    id: string;
    nombre: string;
    categoria: string;
    requiereDireccion: boolean;
    imagen: string | null;
  };
  usuario: { id: string; nombre: string; email: string };
}

const FILTROS: Array<{ value: EstadoCanje | "TODOS"; label: string }> = [
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "PROCESANDO", label: "Procesando" },
  { value: "ENVIADO", label: "Enviados" },
  { value: "ENTREGADO", label: "Entregados" },
  { value: "CANCELADO", label: "Cancelados" },
  { value: "TODOS", label: "Todos" },
];

const SIGUIENTE: Record<EstadoCanje, EstadoCanje | null> = {
  PENDIENTE: "PROCESANDO",
  PROCESANDO: "ENVIADO",
  ENVIADO: "ENTREGADO",
  ENTREGADO: null,
  CANCELADO: null,
};

export function AdminCanjesPanel() {
  const [filtro, setFiltro] = useState<EstadoCanje | "TODOS">("PENDIENTE");
  const [canjes, setCanjes] = useState<CanjeAdmin[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    setCargando(true);
    setError("");
    try {
      const url =
        filtro === "TODOS"
          ? "/api/v1/admin/canjes"
          : `/api/v1/admin/canjes?estado=${filtro}`;
      const resp = await authedFetch(url);
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "Error");
        return;
      }
      setCanjes(json.data.canjes);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function transicionar(
    canje: CanjeAdmin,
    nuevo: EstadoCanje,
    meta: { metodo?: string; codigoSeguimiento?: string; motivoCancelacion?: string } = {},
  ) {
    const resp = await authedFetch(`/api/v1/admin/canjes/${canje.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo, ...meta }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      alert(json?.error?.message ?? "Error");
      return;
    }
    fetchData();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
              filtro === f.value
                ? "bg-brand-blue-main text-white"
                : "border border-light bg-card text-body hover:bg-hover"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cargando && <div className="text-[13px] text-muted-d">Cargando...</div>}
      {error && (
        <div className="rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
          {error}
        </div>
      )}
      {!cargando && canjes.length === 0 && (
        <div className="rounded-md border border-light bg-card px-4 py-8 text-center text-body">
          No hay canjes en este estado.
        </div>
      )}

      <div className="space-y-3">
        {canjes.map((canje) => {
          const siguiente = SIGUIENTE[canje.estado];
          return (
            <article
              key={canje.id}
              className="rounded-md border border-light bg-card p-4 shadow-sm"
              data-testid={`admin-canje-${canje.id}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                      {canje.premio.imagen ?? "🎁"}
                    </span>
                    <div>
                      <div className="font-display text-[15px] font-bold text-dark">
                        {canje.premio.nombre}
                      </div>
                      <div className="text-[12px] text-muted-d">
                        {canje.usuario.nombre} · {canje.usuario.email}
                      </div>
                    </div>
                    <EstadoBadge estado={canje.estado} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-muted-d">
                    <span>
                      <strong>{canje.lukasUsados} 🪙</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Solicitado:{" "}
                      {new Date(canje.creadoEn).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </span>
                  </div>
                  {canje.direccion && (
                    <details className="mt-2 rounded-md bg-subtle p-2 text-[12px]">
                      <summary className="cursor-pointer font-bold text-dark">
                        Dirección de envío
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-body">
                        {JSON.stringify(canje.direccion, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {siguiente && (
                    <button
                      type="button"
                      onClick={() => {
                        if (siguiente === "ENVIADO") {
                          const metodo = prompt("Método (ej. 'Courier', 'Gift card digital'):");
                          if (!metodo) return;
                          const tracking = prompt("Código de seguimiento (opcional):") || undefined;
                          transicionar(canje, siguiente, { metodo, codigoSeguimiento: tracking });
                        } else {
                          transicionar(canje, siguiente);
                        }
                      }}
                      className="rounded-md bg-brand-green px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90"
                    >
                      → {siguiente}
                    </button>
                  )}
                  {canje.estado !== "ENTREGADO" && canje.estado !== "CANCELADO" && (
                    <button
                      type="button"
                      onClick={() => {
                        const motivo = prompt("Motivo de cancelación:") || "Cancelado";
                        if (
                          confirm(
                            `¿Cancelar y reembolsar ${canje.lukasUsados} Lukas?`,
                          )
                        ) {
                          transicionar(canje, "CANCELADO", { motivoCancelacion: motivo });
                        }
                      }}
                      className="rounded-md border border-urgent-critical px-3 py-1.5 text-[12px] font-bold text-urgent-critical hover:bg-urgent-critical hover:text-white"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoCanje }) {
  const cls: Record<EstadoCanje, string> = {
    PENDIENTE: "bg-urgent-med-bg text-urgent-high",
    PROCESANDO: "bg-alert-info-bg text-alert-info-text",
    ENVIADO: "bg-brand-blue-main text-white",
    ENTREGADO: "bg-alert-success-bg text-alert-success-text",
    CANCELADO: "bg-pred-wrong-bg text-pred-wrong",
  };
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls[estado]}`}>
      {estado}
    </span>
  );
}
