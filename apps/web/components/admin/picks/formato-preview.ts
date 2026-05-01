// Wrapper client-side de `formatearPickPremium` para el preview en
// /admin/picks-premium. Lote F (May 2026).
//
// `formatearPickPremium` (Lote E) recibe un PickPremium completo + Partido +
// Casa (relations Prisma). Para el preview admin tenemos solo el `PickDetalleAdmin`
// serializable. Mapeamos los campos relevantes a un shape mínimo compatible.
import { formatearPickPremium } from "@/lib/services/whatsapp/pick-formato";
import type { PickDetalleAdmin } from "@/lib/services/picks-premium-admin.service";

export function formatearPickPremiumPreview(
  pick: PickDetalleAdmin,
  watermark: string,
): string {
  // Construir un objeto compatible con la firma de formatearPickPremium.
  // Solo los campos usados por el formato — el resto va con valores
  // dummy aceptables para el render.
  const fakePick = {
    id: pick.id,
    partidoId: pick.partidoId,
    mercado: pick.mercado as "RESULTADO_1X2",
    outcome: pick.outcome,
    cuotaSugerida: pick.cuotaSugerida,
    stakeSugerido: pick.stakeSugerido,
    evPctSugerido: pick.evPctSugerido,
    casaRecomendadaId: pick.casaRecomendada?.id ?? null,
    razonamiento: pick.razonamiento,
    estadisticas: pick.estadisticas as unknown,
    generadoPor: pick.generadoPor as "CLAUDE_API",
    generadoEn: pick.generadoEn,
    estado: pick.estado as "PENDIENTE",
    aprobado: pick.aprobado,
    aprobadoPor: pick.aprobadoPor,
    aprobadoEn: pick.aprobadoEn,
    rechazadoMotivo: pick.rechazadoMotivo,
    enviadoAlChannel: pick.enviadoAlChannel,
    enviadoEn: pick.enviadoEn,
    channelMessageId: pick.channelMessageId,
    resultadoFinal: pick.resultadoFinal as null,
    evaluadoEn: pick.evaluadoEn,
    fechaPublicacion: pick.fechaPublicacion,
    creadoEn: pick.generadoEn,
    actualizadoEn: pick.generadoEn,
    partido: {
      id: pick.partidoId,
      externalId: "",
      liga: pick.liga,
      equipoLocal: pick.equipoLocal,
      equipoVisita: pick.equipoVisita,
      fechaInicio: pick.fechaInicio,
      estado: "PROGRAMADO" as const,
      golesLocal: null,
      golesVisita: null,
      btts: null,
      mas25Goles: null,
      huboTarjetaRoja: null,
      round: null,
      venue: null,
      creadoEn: pick.generadoEn,
      liveStatusShort: null,
      liveElapsed: null,
      liveExtra: null,
      liveUpdatedAt: null,
    },
    casaRecomendada: pick.casaRecomendada
      ? {
          id: pick.casaRecomendada.id,
          slug: pick.casaRecomendada.slug,
          nombre: pick.casaRecomendada.nombre,
          logoUrl: null,
          autorizadoMincetur: true,
          urlBase: pick.casaRecomendada.urlBase,
          modeloComision: "CPA",
          montoCpa: null,
          porcentajeRevshare: null,
          bonoActual: null,
          metodosPago: [],
          pros: null,
          contras: null,
          rating: null,
          activo: true,
          ordenDestacado: 100,
          ultimaVerificacionMincetur: null,
          verificacionPendiente: false,
          creadoEn: pick.generadoEn,
          actualizadoEn: pick.generadoEn,
        }
      : null,
  };

  // formatearPickPremium tiene tipos estrictos de Prisma — castear vía
  // Parameters<>[0] basta para el bridge sin perder strict typing.
  return formatearPickPremium(
    fakePick as Parameters<typeof formatearPickPremium>[0],
    { watermark },
  );
}
