// AlarmaBanner — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-alarm-banner (líneas 4958-4965).
// HTML idéntico al mockup, clases del mockup (admin-alarm-banner /
// admin-alarm-icon / admin-alarm-text / btn btn-ghost btn-sm) que viven
// en `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Renderiza el resumen de alarmas activas. El mockup muestra el caso
// pluralizado con resumen breve + CTA "Ver alarmas →"; cuando N=1 lo
// adaptamos manteniendo la misma estructura HTML.
import Link from "next/link";
import type { Alarma } from "@/lib/services/admin-kpis.service";

interface AlarmaBannerProps {
  alarmas: Alarma[];
}

export function AlarmaBanner({ alarmas }: AlarmaBannerProps) {
  if (alarmas.length === 0) return null;

  const resumen =
    alarmas.length === 1
      ? `${alarmas[0].kpi} · valor actual ${alarmas[0].valorActual} · umbral ${alarmas[0].umbral}`
      : alarmas
          .slice(0, 3)
          .map((a) => `${a.kpi} (${a.valorActual})`)
          .join(" · ");

  return (
    <div className="admin-alarm-banner">
      <div className="admin-alarm-icon">🚨</div>
      <div className="admin-alarm-text">
        <strong>{alarmas.length} alarma{alarmas.length > 1 ? "s" : ""} activa{alarmas.length > 1 ? "s" : ""}</strong> · {resumen}
      </div>
      <Link href="/admin/alarmas" className="btn btn-ghost btn-sm">
        Ver alarmas →
      </Link>
    </div>
  );
}
