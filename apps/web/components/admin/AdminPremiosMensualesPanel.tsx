"use client";
// Panel admin de premios mensuales — Lote 5.
//
// Tabla editable: cada fila muestra mes, posición, ganador, monto y
// estado. Click "Editar" abre form inline con:
//   - Estado: select PENDIENTE|COORDINADO|PAGADO|CANCELADO
//   - Datos de pago: textarea JSON
//   - Notas: textarea libre
//
// Botón "Copiar template" pega en clipboard el texto canónico para
// responder al ganador desde Resend.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import type { EstadoPremio } from "@/lib/services/leaderboard.service";

interface PremioFila {
  id: string;
  leaderboardId: string;
  mes: string;
  nombreMes: string;
  posicion: number;
  userId: string;
  username: string;
  email: string;
  nombre: string;
  montoSoles: number;
  estado: EstadoPremio;
  datosPago: unknown;
  pagadoEn: string | null;
  notas: string | null;
  creadoEn: string;
}

interface Props {
  premios: PremioFila[];
  filtroEstado: EstadoPremio | "TODOS";
  filtroMes: string;
  premioPrimerPuesto: number;
}

const ESTADOS: ReadonlyArray<{
  value: EstadoPremio | "TODOS";
  label: string;
  className: string;
}> = [
  { value: "TODOS", label: "Todos", className: "" },
  {
    value: "PENDIENTE",
    label: "Pendiente",
    className: "bg-urgent-high/[0.15] text-urgent-high-dark",
  },
  {
    value: "COORDINADO",
    label: "Coordinado",
    className: "bg-brand-blue-main/[0.12] text-brand-blue-main",
  },
  {
    value: "PAGADO",
    label: "Pagado",
    className: "bg-brand-green/[0.18] text-alert-success-text",
  },
  {
    value: "CANCELADO",
    label: "Cancelado",
    className: "bg-subtle text-muted-d",
  },
];

export function AdminPremiosMensualesPanel({
  premios,
  filtroEstado,
  filtroMes,
  premioPrimerPuesto,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  function setFiltro(next: { estado?: string; mes?: string }) {
    const params = new URLSearchParams();
    const estado = next.estado ?? filtroEstado;
    const mes = next.mes ?? filtroMes;
    if (estado && estado !== "TODOS") params.set("estado", estado);
    if (mes) params.set("mes", mes);
    router.replace(
      `/admin/premios-mensuales${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Estado
            <select
              value={filtroEstado}
              onChange={(e) => setFiltro({ estado: e.target.value })}
              className="rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Mes (YYYY-MM)
            <input
              type="text"
              defaultValue={filtroMes}
              onBlur={(e) => setFiltro({ mes: e.target.value.trim() })}
              placeholder="Cualquiera"
              className="w-32 rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
            />
          </label>
          <span className="ml-auto text-[12px] text-muted-d">
            {premios.length} premio{premios.length === 1 ? "" : "s"}
          </span>
        </div>

        {premios.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-8 text-center text-[13px] text-muted-d">
            No hay premios con los filtros actuales. Si todavía no cerraste
            ningún mes, andá a{" "}
            <a
              href="/admin/leaderboard"
              className="font-semibold text-brand-blue-main hover:underline"
            >
              /admin/leaderboard
            </a>{" "}
            y forzá un cierre manual.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Ganador</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Pagado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {premios.map((p) => (
                  <FilaPremio
                    key={p.id}
                    premio={p}
                    isEditing={editingId === p.id}
                    onStartEdit={() => setEditingId(p.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      router.refresh();
                      toast.show("✅ Premio actualizado");
                    }}
                    onError={(msg: string) => toast.show(`❌ ${msg}`)}
                    onCopyTemplate={() => {
                      const tpl = templateRespuesta(p, premioPrimerPuesto);
                      navigator.clipboard.writeText(tpl);
                      toast.show("📋 Template copiado al clipboard");
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilaPremio({
  premio,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onError,
  onCopyTemplate,
}: {
  premio: PremioFila;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  onCopyTemplate: () => void;
}) {
  const estadoCfg = ESTADOS.find((e) => e.value === premio.estado);
  const [estado, setEstado] = useState<EstadoPremio>(premio.estado);
  const [datosPagoStr, setDatosPagoStr] = useState(
    premio.datosPago ? JSON.stringify(premio.datosPago, null, 2) : "",
  );
  const [notas, setNotas] = useState(premio.notas ?? "");
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    setGuardando(true);
    try {
      let datosPago: Record<string, unknown> | null | undefined = undefined;
      if (datosPagoStr.trim() === "") {
        datosPago = null;
      } else {
        try {
          datosPago = JSON.parse(datosPagoStr) as Record<string, unknown>;
        } catch {
          throw new Error("datosPago no es JSON válido.");
        }
      }
      const res = await authedFetch(
        `/api/v1/admin/premios-mensuales/${premio.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado,
            datosPago,
            notas: notas.trim() === "" ? null : notas,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Error al guardar.");
      }
      onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <tr className="text-dark">
        <td className="px-3 py-2 font-semibold">{premio.mes}</td>
        <td className="px-3 py-2">{premio.posicion === 0 ? "—" : `${premio.posicion}°`}</td>
        <td className="px-3 py-2">
          <div className="font-semibold">@{premio.username}</div>
          <div className="text-[11px] text-muted-d">{premio.email}</div>
        </td>
        <td className="px-3 py-2 text-right font-display font-black text-brand-gold-dark">
          {premio.montoSoles === 0 ? "—" : `S/ ${premio.montoSoles}`}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] ${
              estadoCfg?.className ?? "bg-subtle text-muted-d"
            }`}
          >
            {premio.estado}
          </span>
        </td>
        <td className="px-3 py-2 text-[11px] text-muted-d">
          {premio.pagadoEn
            ? new Date(premio.pagadoEn).toLocaleDateString("es-PE", {
                timeZone: "America/Lima",
                day: "2-digit",
                month: "short",
              })
            : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="inline-flex flex-wrap justify-end gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onCopyTemplate}
                  className="text-[12px] font-semibold text-brand-blue-main hover:underline"
                >
                  📋 Copiar template
                </button>
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="text-[12px] font-semibold text-dark hover:underline"
                >
                  Editar
                </button>
              </>
            ) : null}
          </div>
        </td>
      </tr>

      {isEditing ? (
        <tr className="bg-subtle/50">
          <td colSpan={7} className="px-3 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                Estado
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoPremio)}
                  className="rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
                >
                  {ESTADOS.filter((e) => e.value !== "TODOS").map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d md:col-span-2">
                Datos de pago (JSON; vacío = limpiar)
                <textarea
                  value={datosPagoStr}
                  onChange={(e) => setDatosPagoStr(e.target.value)}
                  rows={4}
                  placeholder={`{\n  "tipo": "yape",\n  "numero": "999999999",\n  "titular": "Juan Pérez",\n  "dni": "12345678"\n}`}
                  className="rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-mono text-[12px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d md:col-span-2">
                Notas
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Notas internas (no se muestran al ganador)"
                  className="rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleGuardar}
                disabled={guardando}
              >
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-md border-[1.5px] border-light bg-card px-4 py-2 text-[13px] font-bold text-muted-d hover:border-strong hover:text-dark"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function templateRespuesta(p: PremioFila, premioPrimerPuesto: number): string {
  const ordinal = `${p.posicion}°`;
  const mesSiguienteApertura = formatMesNumeroSiguiente(p.mes);
  return `Hola @${p.username},

¡Felicidades por quedar ${ordinal} en el leaderboard de Habla! del mes de ${p.nombreMes}!
Confirmamos tu premio de S/ ${p.montoSoles} en efectivo.

[ Acá pegás los datos de pago coordinados: Yape / Plin / cuenta bancaria ]

Te confirmamos el envío en cuanto se haga la transferencia (máximo 3 días hábiles).

Seguimos con el leaderboard de ${mesSiguienteApertura} — el premio del 1° lugar es S/ ${premioPrimerPuesto}.

¡Gracias por jugar Habla!
— Equipo Habla!`;
}

function formatMesNumeroSiguiente(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const nextY = mo === 12 ? y + 1 : y;
  const nextM = mo === 12 ? 1 : mo + 1;
  const ref = new Date(Date.UTC(nextY, nextM - 1, 15, 12));
  const nombre = ref
    .toLocaleDateString("es-PE", { timeZone: "America/Lima", month: "long" })
    .toLowerCase();
  return `${nombre} ${nextY}`;
}
