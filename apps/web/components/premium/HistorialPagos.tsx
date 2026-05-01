// HistorialPagos — lista de últimos pagos en mi-suscripcion (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.

import { formatearFechaLargaPe } from "@/lib/utils/datetime";
import type { PlanKey } from "@/lib/premium-planes";
import { PLANES } from "@/lib/premium-planes";

interface PagoUI {
  id: string;
  fecha: Date;
  plan: PlanKey;
  monto: number; // céntimos
  estado: "PAGADO" | "RECHAZADO" | "REEMBOLSADO" | "PENDIENTE" | "TIMEOUT";
  ultimosCuatro: string | null;
  marcaTarjeta: string | null;
}

interface Props {
  pagos: Array<PagoUI>;
}

export function HistorialPagos({ pagos }: Props) {
  if (pagos.length === 0) {
    return (
      <section className="border-y border-light bg-card px-4 py-5">
        <h3 className="mb-3 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
          💳 Historial de pagos
        </h3>
        <p className="rounded-md bg-subtle px-3 py-4 text-center text-body-xs text-muted-d">
          Sin pagos registrados.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Historial de pagos"
      className="border-y border-light bg-card px-4 py-5"
    >
      <h3 className="mb-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        💳 Historial de pagos
      </h3>
      <ul className="divide-y divide-light">
        {pagos.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 py-2.5 text-body-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-dark">
                {formatearFechaLargaPe(p.fecha)}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-d">
                Plan {PLANES[p.plan].label}
                {p.marcaTarjeta && p.ultimosCuatro
                  ? ` · ${p.marcaTarjeta} •••• ${p.ultimosCuatro}`
                  : ""}
              </p>
            </div>
            <div className="font-display text-display-xs font-extrabold text-dark">
              S/ {(p.monto / 100).toFixed(p.monto % 100 === 0 ? 0 : 2)}
            </div>
            <PagoBadge estado={p.estado} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PagoBadge({ estado }: { estado: PagoUI["estado"] }) {
  const cfg = (() => {
    if (estado === "PAGADO")
      return { txt: "✓ Pagado", cls: "bg-status-green-bg text-status-green-text" };
    if (estado === "REEMBOLSADO")
      return {
        txt: "Reembolsado",
        cls: "bg-status-amber-bg text-status-amber-text",
      };
    if (estado === "RECHAZADO")
      return {
        txt: "Rechazado",
        cls: "bg-status-red-bg text-status-red-text",
      };
    return {
      txt: "Pendiente",
      cls: "bg-status-neutral-bg text-status-neutral-text",
    };
  })();
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.05em] ${cfg.cls}`}
    >
      {cfg.txt}
    </span>
  );
}
