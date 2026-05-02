// AlarmaBanner — banner persistente cuando hay KPI rojo o alarmas activas.
// Lote F (May 2026). Spec: docs/ux-spec/05-pista-admin-operacion/dashboard.spec.md.
//
// Si N=1: muestra mensaje completo con CTA "Ver detalle".
// Si N>1: "X alarmas activas. Ver todas →" linkea a /admin/alarmas (Lote G).
import Link from "next/link";
import type { Alarma } from "@/lib/services/admin-kpis.service";
import { cn } from "@/lib/utils/cn";

interface AlarmaBannerProps {
  alarmas: Alarma[];
}

const SEVERIDAD_BG: Record<Alarma["severidad"], string> = {
  info: "bg-status-amber-bg border-status-amber",
  warning: "bg-status-amber-bg border-status-amber",
  critical: "bg-status-red-bg border-status-red",
};

const SEVERIDAD_TEXT: Record<Alarma["severidad"], string> = {
  info: "text-status-amber-text",
  warning: "text-status-amber-text",
  critical: "text-status-red-text",
};

export function AlarmaBanner({ alarmas }: AlarmaBannerProps) {
  if (alarmas.length === 0) return null;

  if (alarmas.length === 1) {
    const a = alarmas[0];
    return (
      <div
        role="alert"
        className={cn(
          "mb-4 flex items-start gap-3 rounded-md border p-3",
          SEVERIDAD_BG[a.severidad],
        )}
      >
        <span aria-hidden className={cn("text-[18px]", SEVERIDAD_TEXT[a.severidad])}>
          ⚠
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn("text-admin-card-title", SEVERIDAD_TEXT[a.severidad])}>
            {a.kpi}
          </div>
          <div className="mt-0.5 text-admin-meta text-dark">
            Valor actual <strong>{a.valorActual}</strong> · umbral{" "}
            <strong>{a.umbral}</strong> · {a.accionSugerida}
          </div>
        </div>
        <Link
          href={a.href}
          className="text-admin-meta font-bold text-dark underline transition-colors hover:no-underline"
        >
          Ver detalle →
        </Link>
      </div>
    );
  }

  // N > 1: resumen + link al listing
  const peor = alarmas.find((a) => a.severidad === "critical") ?? alarmas[0];
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-center justify-between gap-3 rounded-md border p-3",
        SEVERIDAD_BG[peor.severidad],
      )}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("text-[18px]", SEVERIDAD_TEXT[peor.severidad])}>
          ⚠
        </span>
        <div className={cn("text-admin-card-title", SEVERIDAD_TEXT[peor.severidad])}>
          {alarmas.length} alarmas activas
        </div>
      </div>
      <Link
        href="/admin/alarmas"
        className="text-admin-meta font-bold text-dark underline transition-colors hover:no-underline"
      >
        Ver todas →
      </Link>
    </div>
  );
}
