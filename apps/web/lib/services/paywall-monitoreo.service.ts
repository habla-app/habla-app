// paywall-monitoreo.service.ts — Lote P (May 2026).
// Servicio de monitoreo del paywall Free vs Socios para `/admin/paywall`.
//
// La política está hardcodeada en `lib/config/paywall.ts` (decisión §1.5).
// Esta vista solo MIDE conversión, no configura.
//
// Eventos consumidos (de `eventos_analitica`):
//   - `paywall_visto`           usuario Free vio un bloque bloqueado de Socios
//   - `socios_cta_click`        usuario Free clickeó "Hacete Socio" desde el paywall
//   - `socios_suscripcion_nueva` usuario completó pago y quedó como Socio
//
// Si los eventos aún no se trackean en producción, las cuentas devuelven
// 0 y la vista lo refleja como "—" o ratios 0%. El primer mes los datos
// son escasos y el panel cumple igual con los filtros y el layout.

import { prisma } from "@habla/db";
import { logger } from "./logger";

export interface KPIsPaywall {
  vistasPaywall: number;
  clicksHaceteSocio: number;
  nuevasSuscripciones: number;
  /** Ratio: clicks "Hacete Socio" / vistas paywall (0-1). */
  ctrPaywall: number;
  /** Ratio: nuevas suscripciones Socios / clicks "Hacete Socio" (0-1). */
  pctConversionSocio: number;
}

/**
 * Devuelve KPIs de conversión del paywall en los últimos 30 días.
 * Cache implícito: la página /admin/paywall lo invoca con `force-dynamic`
 * y Postgres responde sub-100ms para counts simples.
 */
export async function obtenerKPIsConversionPaywall(): Promise<KPIsPaywall> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [vistas, clicks, nuevas] = await Promise.all([
      prisma.eventoAnalitica.count({
        where: { evento: "paywall_visto", creadoEn: { gte: desde } },
      }),
      prisma.eventoAnalitica.count({
        where: { evento: "socios_cta_click", creadoEn: { gte: desde } },
      }),
      prisma.suscripcion.count({
        where: { iniciada: { gte: desde }, activa: true },
      }),
    ]);

    const ctrPaywall = vistas > 0 ? clicks / vistas : 0;
    const pctConversionSocio = clicks > 0 ? nuevas / clicks : 0;

    return {
      vistasPaywall: vistas,
      clicksHaceteSocio: clicks,
      nuevasSuscripciones: nuevas,
      ctrPaywall,
      pctConversionSocio,
    };
  } catch (err) {
    logger.error({ err, source: "paywall-monitoreo:kpis" }, "Falla al leer KPIs del paywall");
    return {
      vistasPaywall: 0,
      clicksHaceteSocio: 0,
      nuevasSuscripciones: 0,
      ctrPaywall: 0,
      pctConversionSocio: 0,
    };
  }
}
