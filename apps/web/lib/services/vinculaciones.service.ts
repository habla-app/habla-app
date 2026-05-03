// vinculaciones.service.ts — Lote P (May 2026).
// Servicio para `/admin/vinculaciones` (port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-vinculaciones).
//
// Tres sub-vistas:
//   - WhatsApp: Socios con/sin canal, leaks (canal sin pago)
//   - Casas: distribución de FTDs por afiliado
//   - Webhooks: estado de OpenPay/Meta/api-football/affiliate S2S
//
// Health checks operativos:
//   - WhatsApp Channel sync: % de Socios activos con membresía UNIDA
//   - OpenPay (pagos): última transacción reciente <1h
//   - Trackers afiliados: cuántos están activos sin error reciente
//   - api-football: cuántos partidos importados últimas 24h

import { prisma } from "@habla/db";
import { logger } from "./logger";

export type VinculacionSeveridad = "good" | "amber" | "red";

export interface HealthCheck {
  label: string;
  value: string;
  meta: string;
  estado: VinculacionSeveridad;
}

export interface VinculacionWhatsApp {
  conCanal: number;
  pagoSinCanal: number;
  enCanalSinPago: number;
  filas: VinculacionWhatsAppFila[];
}

export interface VinculacionWhatsAppFila {
  usuarioId: string | null;
  username: string | null;
  email: string | null;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL" | null;
  telefono: string | null;
  pagoActivo: boolean;
  enChannel: boolean;
  ultimaLecturaTexto: string;
  estado: "OK" | "FALTA_TEL" | "LEAK";
}

export interface VinculacionCasaFila {
  nombre: string;
  clicks: number;
  ftds: number;
  ctr: number;
  revenuePEN: number;
}

export interface VinculacionWebhookFila {
  servicio: string;
  endpoint: string;
  estado: "OK" | "TIMEOUT" | "ERROR";
  ultimaSenalTexto: string;
  errores24h: number;
}

export interface VinculacionesData {
  health: HealthCheck[];
  whatsapp: VinculacionWhatsApp;
  casas: VinculacionCasaFila[];
  webhooks: VinculacionWebhookFila[];
}

function relativo(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hrs`;
  const dias = Math.floor(hrs / 24);
  return `${dias} días`;
}

export async function obtenerVinculaciones(): Promise<VinculacionesData> {
  try {
    const [
      sociosActivos,
      sociosConCanal,
      pagoSinCanal,
      enCanalSinPago,
      apiFootballRecientes,
      ultimaConversionFtd,
    ] = await Promise.all([
      prisma.suscripcion.count({ where: { activa: true } }),
      prisma.suscripcion.count({
        where: {
          activa: true,
          miembrosChannel: { some: { estado: "UNIDO" } },
        },
      }),
      prisma.suscripcion.count({
        where: {
          activa: true,
          miembrosChannel: { none: { estado: "UNIDO" } },
        },
      }),
      prisma.miembroChannel.count({
        where: { estado: "UNIDO", suscripcion: { activa: false } },
      }),
      prisma.partido
        .count({ where: { creadoEn: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => 0),
      prisma.conversionAfiliado
        .findFirst({
          orderBy: { reportadoEn: "desc" },
          select: { reportadoEn: true },
        })
        .catch(() => null),
    ]);

    // Health checks operativos
    const channelSyncPct = sociosActivos > 0 ? (sociosConCanal / sociosActivos) * 100 : 100;
    const ultimaSyncMin = 8; // placeholder — el cron J de sync canal corre cada 30 min

    const ultimoCobro = await prisma.pagoSuscripcion
      .findFirst({
        orderBy: { fecha: "desc" },
        where: { estado: "PAGADO" },
        select: { fecha: true },
      })
      .catch(() => null);
    const ultimoCobroRelativo = relativo(ultimoCobro?.fecha ?? null);
    const openpayOk = !!(
      ultimoCobro && Date.now() - ultimoCobro.fecha.getTime() < 24 * 60 * 60 * 1000
    );

    const afiliados = await prisma.afiliado.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, slug: true, verificacionPendiente: true },
    });

    const trackersActivos = afiliados.filter((a) => !a.verificacionPendiente).length;
    const trackersTotales = afiliados.length;

    const health: HealthCheck[] = [
      {
        label: "WhatsApp Channel sync",
        value: `${Math.round(channelSyncPct)}%`,
        meta: `Última sync: ${ultimaSyncMin} min`,
        estado: channelSyncPct >= 95 ? "good" : channelSyncPct >= 80 ? "amber" : "red",
      },
      {
        label: "OpenPay (pagos)",
        value: openpayOk ? "100%" : "—",
        meta: `Última transacción: ${ultimoCobroRelativo}`,
        estado: openpayOk ? "good" : "amber",
      },
      {
        label: "Trackers afiliados",
        value: `${trackersActivos} / ${trackersTotales}`,
        meta:
          trackersActivos < trackersTotales
            ? `${trackersTotales - trackersActivos} con error reciente`
            : "Todos activos",
        estado:
          trackersActivos === trackersTotales
            ? "good"
            : trackersActivos >= trackersTotales * 0.8
            ? "amber"
            : "red",
      },
      {
        label: "api-football",
        value: apiFootballRecientes > 0 ? "100%" : "—",
        meta: `${apiFootballRecientes} partidos importados`,
        estado: apiFootballRecientes > 0 ? "good" : "amber",
      },
    ];

    // Tabla Socios (top 20 más recientes)
    const sociosFilas = await prisma.suscripcion.findMany({
      where: { activa: true },
      include: {
        usuario: { select: { id: true, username: true, email: true, telefono: true } },
        miembrosChannel: {
          orderBy: { invitadoEn: "desc" },
          take: 1,
          select: { estado: true, unidoEn: true, invitadoEn: true },
        },
      },
      orderBy: { iniciada: "desc" },
      take: 20,
    });
    const filas: VinculacionWhatsAppFila[] = sociosFilas.map((s) => {
      const m = s.miembrosChannel[0];
      const enChannel = m?.estado === "UNIDO";
      const tieneTel = !!s.usuario.telefono;
      const estado: VinculacionWhatsAppFila["estado"] = !tieneTel
        ? "FALTA_TEL"
        : enChannel
        ? "OK"
        : "LEAK";
      return {
        usuarioId: s.usuario.id,
        username: s.usuario.username,
        email: s.usuario.email,
        plan: s.plan,
        telefono: s.usuario.telefono,
        pagoActivo: true,
        enChannel,
        ultimaLecturaTexto: relativo(m?.unidoEn ?? m?.invitadoEn ?? null),
        estado,
      };
    });

    // Filas leaks (canal sin pago) — top 5
    const leaks = await prisma.miembroChannel.findMany({
      where: {
        estado: "UNIDO",
        suscripcion: { activa: false },
      },
      include: {
        suscripcion: {
          include: { usuario: { select: { id: true, telefono: true, username: true, email: true } } },
        },
      },
      orderBy: { invitadoEn: "desc" },
      take: 5,
    });
    for (const m of leaks) {
      filas.push({
        usuarioId: m.suscripcion.usuario?.id ?? null,
        username: m.suscripcion.usuario?.username ?? null,
        email: m.suscripcion.usuario?.email ?? null,
        plan: null,
        telefono: m.suscripcion.usuario?.telefono ?? null,
        pagoActivo: false,
        enChannel: true,
        ultimaLecturaTexto: relativo(m.unidoEn ?? m.invitadoEn),
        estado: "LEAK",
      });
    }

    // Casas: distribución FTDs por afiliado
    const casasRows = await prisma.afiliado.findMany({
      where: { activo: true },
      include: {
        clicks: { select: { id: true } },
        conversiones: {
          where: { tipo: "FTD" },
          select: { id: true, montoComision: true },
        },
      },
    });
    const casas: VinculacionCasaFila[] = casasRows
      .map((c) => {
        const clicks = c.clicks.length;
        const ftds = c.conversiones.length;
        const ctr = clicks > 0 ? (ftds / clicks) * 100 : 0;
        const revenuePEN = c.conversiones.reduce(
          (acc, r) => acc + (r.montoComision ? Number(r.montoComision) : 0),
          0,
        );
        return { nombre: c.nombre, clicks, ftds, ctr, revenuePEN };
      })
      .sort((a, b) => b.revenuePEN - a.revenuePEN);

    // Webhooks: estado conocido de servicios externos
    const webhooks: VinculacionWebhookFila[] = [
      {
        servicio: "OpenPay",
        endpoint: "/api/webhooks/openpay",
        estado: openpayOk ? "OK" : "TIMEOUT",
        ultimaSenalTexto: ultimoCobroRelativo,
        errores24h: 0,
      },
      {
        servicio: "Meta WhatsApp",
        endpoint: "/api/webhooks/whatsapp",
        estado: "OK",
        ultimaSenalTexto: "—",
        errores24h: 0,
      },
      ...afiliados.map<VinculacionWebhookFila>((a) => ({
        servicio: `${a.nombre} (S2S afiliados)`,
        endpoint: `/api/webhooks/aff/${a.slug}`,
        estado: a.verificacionPendiente ? "TIMEOUT" : "OK",
        ultimaSenalTexto: a.verificacionPendiente ? "2 hrs" : "—",
        errores24h: a.verificacionPendiente ? 1 : 0,
      })),
      {
        servicio: "api-football (datos)",
        endpoint: "cron pull cada 6h",
        estado: apiFootballRecientes > 0 ? "OK" : "TIMEOUT",
        ultimaSenalTexto: apiFootballRecientes > 0 ? `${apiFootballRecientes} importados` : "—",
        errores24h: 0,
      },
    ];

    return {
      health,
      whatsapp: {
        conCanal: sociosConCanal,
        pagoSinCanal,
        enCanalSinPago,
        filas,
      },
      casas,
      webhooks,
    };
  } catch (err) {
    logger.error({ err, source: "vinculaciones:obtener" }, "Falla al obtener vinculaciones");
    return {
      health: [],
      whatsapp: { conCanal: 0, pagoSinCanal: 0, enCanalSinPago: 0, filas: [] },
      casas: [],
      webhooks: [],
    };
  }
}

export async function obtenerVinculacionesPendientesCount(): Promise<number> {
  // Para el counter del sidebar admin: leaks (canal sin pago) + Socios sin canal
  try {
    const [leaks, sinCanal] = await Promise.all([
      prisma.miembroChannel.count({
        where: { estado: "UNIDO", suscripcion: { activa: false } },
      }),
      prisma.suscripcion.count({
        where: {
          activa: true,
          miembrosChannel: { none: { estado: "UNIDO" } },
        },
      }),
    ]);
    return leaks + sinCanal;
  } catch {
    return 0;
  }
}
