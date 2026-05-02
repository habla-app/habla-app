// EstadoUsuarioBanner — banner contextual según el estado del usuario
// logueado. Lote B (componente nuevo). Spec:
// docs/ux-spec/02-pista-usuario-publica/home.spec.md §"Estados de UI" +
// docs/ux-spec/01-arquitectura/flujos-navegacion.md §"Reglas de visibilidad
// de CTAs por estado".
//
// Reglas:
// - anonimo: no se renderiza (el visitante anónimo ve solo el hero).
// - free:    "🏆 Compite gratis · Top 10 gana S/ 1,250 al mes".
// - ftd:     "📊 Tu acierto: X% · Premium llega a 65%".
// - premium: "💎 Tu canal Premium · Próximo cobro DD MMM".
//
// Datos opcionales del usuario (`acierto`, `proximoCobro`) se pasan como
// props. Mientras Lote E no exista, free/ftd/premium siguen siendo
// 'free' fallback — el banner muestra la versión "free" simple.

import Link from "next/link";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface Props {
  estado: EstadoUsuario;
  /** Lote E: % acierto histórico para el copy del FTD. Opcional. */
  acierto?: number;
  /** Lote E: fecha del próximo cobro. Opcional. */
  proximoCobro?: Date;
}

export function EstadoUsuarioBanner({ estado, acierto, proximoCobro }: Props) {
  if (estado === "anonimo") return null;

  if (estado === "premium") {
    const fecha = proximoCobro
      ? proximoCobro.toLocaleDateString("es-PE", {
          day: "numeric",
          month: "short",
        })
      : "próximo mes";
    return (
      <Link
        href="/premium/mi-suscripcion"
        className="mb-6 flex items-center justify-between gap-3 rounded-md bg-premium-card-gradient px-4 py-3 text-premium-text-on-dark shadow-premium-card transition-all hover:-translate-y-px"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            💎
          </span>
          <div>
            <p className="text-display-xs text-brand-gold">
              Tu canal Premium activo
            </p>
            <p className="text-body-xs text-premium-text-muted-on-dark">
              Próximo cobro: {fecha}
            </p>
          </div>
        </div>
        <span aria-hidden className="text-brand-gold">
          →
        </span>
      </Link>
    );
  }

  if (estado === "ftd") {
    return (
      <Link
        href="/premium"
        className="mb-6 flex items-center justify-between gap-3 rounded-md border-[1.5px] border-brand-gold bg-gradient-to-r from-brand-gold/10 to-card px-4 py-3 transition-all hover:-translate-y-px"
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            📊
          </span>
          <div>
            <p className="text-display-xs text-dark">
              Tu acierto: {acierto !== undefined ? `${acierto}%` : "47%"}
            </p>
            <p className="text-body-xs text-muted-d">
              Premium llega a 65%. Probar 7 días gratis →
            </p>
          </div>
        </div>
      </Link>
    );
  }

  // free
  return (
    <Link
      href="/comunidad"
      className="mb-6 flex items-center justify-between gap-3 rounded-md border border-light bg-card px-4 py-3 transition-all hover:-translate-y-px hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          🏆
        </span>
        <div>
          <p className="text-display-xs text-dark">
            Compite gratis en la Liga Habla!
          </p>
          <p className="text-body-xs text-muted-d">
            Top 10 gana S/ 1,250 cada mes
          </p>
        </div>
      </div>
      <span aria-hidden className="text-brand-blue-main">
        →
      </span>
    </Link>
  );
}
