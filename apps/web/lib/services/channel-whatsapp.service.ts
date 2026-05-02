// Servicio para `/admin/channel-whatsapp` — Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/channel-whatsapp.spec.md.
//
// Métricas de membresía + engagement + picks recientes + alertas de leak.
// El "engagement %" es aproximado: usamos relación picks enviados / suscriptores
// como proxy. La métrica real (lecturas / envíos del Cloud API) requiere un
// modelo `StatusMensajeBot` que no fue creado en Lote E. Lo dejamos
// preparado en `obtenerEngagementUltimos30d` con valores derivados de la
// data disponible y un `pct` placeholder en 0 si no podemos calcular —
// el cálculo real se cabla en Lote G cuando agreguemos la tabla de status.

import { prisma } from "@habla/db";

export interface StatsMembresia {
  suscriptoresActivos: number;
  miembrosUnidos: number;
  pendientesUnirse: number;
  removidosUltMes: number;
}

export async function obtenerStatsMembresia(): Promise<StatsMembresia> {
  const haceUnMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activas, unidos, pendientes, removidos] = await Promise.all([
    prisma.suscripcion.count({ where: { activa: true } }),
    prisma.miembroChannel.count({ where: { estado: "UNIDO" } }),
    prisma.miembroChannel.count({
      where: {
        estado: { in: ["INVITADO", "REINVITADO"] },
        invitadoEn: { lt: hace24h },
      },
    }),
    prisma.miembroChannel.count({
      where: { estado: "REMOVIDO", removidoEn: { gte: haceUnMes } },
    }),
  ]);

  return {
    suscriptoresActivos: activas,
    miembrosUnidos: unidos,
    pendientesUnirse: pendientes,
    removidosUltMes: removidos,
  };
}

export interface EngagementDia {
  fecha: Date;
  envios: number;
  // pct = lecturas/envíos. Sin tabla de status lo dejamos en 0.
  pct: number;
}

export async function obtenerEngagementUltimos30d(): Promise<EngagementDia[]> {
  const dias: EngagementDia[] = [];
  for (let i = 29; i >= 0; i--) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - i);
    fecha.setHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);

    const envios = await prisma.pickPremium.count({
      where: {
        enviadoAlChannel: true,
        enviadoEn: { gte: fecha, lte: fin },
      },
    });

    dias.push({ fecha, envios, pct: 0 });
  }
  return dias;
}

export interface PickEnviadoFila {
  id: string;
  partidoId: string;
  equipoLocal: string;
  equipoVisita: string;
  liga: string;
  mercado: string;
  outcome: string;
  cuotaSugerida: number;
  enviadoEn: Date | null;
  resultadoFinal: string | null;
}

export async function obtenerPicksEnviadosRecientes(input: {
  take?: number;
} = {}): Promise<PickEnviadoFila[]> {
  const take = Math.min(50, Math.max(5, input.take ?? 20));
  const rows = await prisma.pickPremium.findMany({
    where: { enviadoAlChannel: true },
    include: { partido: true },
    orderBy: { enviadoEn: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    partidoId: r.partidoId,
    equipoLocal: r.partido.equipoLocal,
    equipoVisita: r.partido.equipoVisita,
    liga: r.partido.liga,
    mercado: r.mercado,
    outcome: r.outcome,
    cuotaSugerida: r.cuotaSugerida,
    enviadoEn: r.enviadoEn,
    resultadoFinal: r.resultadoFinal,
  }));
}

export interface AlertaLeak {
  tipo: "cancelado_aun_unido" | "miembros_excede_activas";
  descripcion: string;
  count: number;
  detalles?: Array<{ email: string; nombre: string }>;
}

/**
 * Alertas de posible "leak" del Channel:
 *   - Suscripciones canceladas que aún tienen `MiembroChannel.estado=UNIDO`.
 *   - Total de UNIDOS > total de suscripciones ACTIVAS (alguien con link viejo).
 */
export async function obtenerAlertasLeakChannel(): Promise<AlertaLeak[]> {
  const alertas: AlertaLeak[] = [];

  const canceladosAunUnidos = await prisma.miembroChannel.findMany({
    where: {
      estado: "UNIDO",
      suscripcion: { OR: [{ activa: false }, { cancelada: true }] },
    },
    include: {
      suscripcion: {
        include: {
          usuario: { select: { email: true, nombre: true } },
        },
      },
    },
    take: 50,
  });

  if (canceladosAunUnidos.length > 0) {
    alertas.push({
      tipo: "cancelado_aun_unido",
      descripcion:
        "Usuarios cancelados o vencidos que aún figuran como UNIDOS en el Channel.",
      count: canceladosAunUnidos.length,
      detalles: canceladosAunUnidos.slice(0, 20).map((m) => ({
        email: m.suscripcion.usuario.email,
        nombre: m.suscripcion.usuario.nombre,
      })),
    });
  }

  const [unidos, activas] = await Promise.all([
    prisma.miembroChannel.count({ where: { estado: "UNIDO" } }),
    prisma.suscripcion.count({ where: { activa: true } }),
  ]);
  if (unidos > activas) {
    alertas.push({
      tipo: "miembros_excede_activas",
      descripcion:
        "Hay más miembros UNIDOS al Channel que suscripciones activas.",
      count: unidos - activas,
    });
  }

  return alertas;
}

export interface InfoUltimoSync {
  // Lote E creó el cron Q (sync membresia) pero no persiste su última corrida
  // — el mejor proxy es el `actualizadoEn` más reciente en MiembroChannel.
  ultimaActualizacion: Date | null;
  miembrosTracked: number;
}

export async function obtenerUltimoSync(): Promise<InfoUltimoSync> {
  const last = await prisma.miembroChannel.findFirst({
    orderBy: { ultimoInviteAt: "desc" },
    select: { ultimoInviteAt: true },
  });
  const total = await prisma.miembroChannel.count();
  return {
    ultimaActualizacion: last?.ultimoInviteAt ?? null,
    miembrosTracked: total,
  };
}
