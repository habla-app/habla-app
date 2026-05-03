// cohortes-semanal.service.ts — Lote P (May 2026).
// Servicio del análisis cohortes semanal para `/admin/cohortes` (port
// literal del mockup `docs/habla-mockup-v3.2.html` § admin-page-cohortes,
// líneas 7401-7577).
//
// Diferencia con `cohortes.service.ts` (Lote G): el del Lote G analiza
// cohortes MENSUALES con buckets day 0/1/7/14/30/60/90. El mockup v3.2
// pide cohortes SEMANALES con buckets sem 0..sem 7. Mantenemos ambos:
//   - El de Lote G sigue disponible si otra vista lo usa.
//   - Este nuevo es la fuente para `/admin/kpis/cohortes` v3.2.
//
// Métricas soportadas:
//   - retention: usuario tiene al menos 1 $pageview en la semana N
//   - ftd: usuario tiene 1 ConversionAfiliado tipo='FTD' en la semana N
//   - socios: usuario tiene Suscripcion activa al fin de la semana N

import { prisma, Prisma } from "@habla/db";
import { logger } from "./logger";

export type MetricaCohorteSemanal = "retention" | "ftd" | "socios";
export type GranularidadCohorte = "semanal" | "diaria" | "mensual";

export interface CohorteSemanalFila {
  /** Etiqueta legible: "11 mar 2026". */
  label: string;
  /** Fecha de inicio (lunes 00:00 PET) en ISO */
  inicioSemanaISO: string;
  /** Total de usuarios registrados en la semana. */
  tamano: number;
  /** % retención en cada semana posterior (sem 0 = 100). null = sin datos aún. */
  semanas: Array<number | null>;
}

export interface CohortesSemanalData {
  metrica: MetricaCohorteSemanal;
  granularidad: GranularidadCohorte;
  cohortes: CohorteSemanalFila[];
  resumen: {
    mejorCohorte: { label: string; pct30d: number } | null;
    peorCohorte: { label: string; pct30d: number } | null;
    promedioUltimas8: number | null;
    targetPct: number;
  };
}

const TARGET_RETENTION = 12;
const SEMANAS_BUCKETS = 8; // sem 0 a sem 7
const COHORTES_TOTAL = 8;

function inicioSemanaLima(d: Date): Date {
  // Lunes 00:00 hora Lima (UTC-5)
  const offset = 5 * 60; // minutos
  const local = new Date(d.getTime() - offset * 60 * 1000);
  const dia = local.getUTCDay() || 7; // 1=lun..7=dom
  local.setUTCDate(local.getUTCDate() - (dia - 1));
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offset * 60 * 1000);
}

function addSemanas(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * 24 * 60 * 60 * 1000);
}

const MES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtFechaCorta(d: Date): string {
  return `${d.getUTCDate()} ${MES_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function obtenerCohortesSemanal(
  metrica: MetricaCohorteSemanal = "retention",
  granularidad: GranularidadCohorte = "semanal",
): Promise<CohortesSemanalData> {
  const ahora = new Date();
  const inicioSemanaActual = inicioSemanaLima(ahora);
  const cohortes: CohorteSemanalFila[] = [];

  try {
    for (let i = COHORTES_TOTAL - 1; i >= 0; i--) {
      const inicio = addSemanas(inicioSemanaActual, -i);
      const fin = addSemanas(inicio, 1);
      const usuarios = await prisma.usuario.findMany({
        where: { creadoEn: { gte: inicio, lt: fin } },
        select: { id: true },
      });
      const userIds = usuarios.map((u) => u.id);

      const semanas: Array<number | null> = [];
      for (let s = 0; s < SEMANAS_BUCKETS; s++) {
        const semDesde = addSemanas(inicio, s);
        const semHasta = addSemanas(inicio, s + 1);
        if (semDesde > ahora) {
          semanas.push(null);
          continue;
        }
        if (userIds.length === 0) {
          semanas.push(0);
          continue;
        }
        if (s === 0) {
          semanas.push(100);
          continue;
        }
        const activos = await contarActivos(metrica, userIds, semDesde, semHasta);
        semanas.push(Math.round((activos / userIds.length) * 100));
      }

      cohortes.push({
        label: fmtFechaCorta(inicio),
        inicioSemanaISO: inicio.toISOString(),
        tamano: usuarios.length,
        semanas,
      });
    }

    // Resumen
    const cohortesConSem4 = cohortes
      .map((c) => ({ label: c.label, pct: c.semanas[4] }))
      .filter((c): c is { label: string; pct: number } => c.pct !== null);
    let mejorCohorte: { label: string; pct30d: number } | null = null;
    let peorCohorte: { label: string; pct30d: number } | null = null;
    for (const c of cohortesConSem4) {
      if (!mejorCohorte || c.pct > mejorCohorte.pct30d) mejorCohorte = { label: c.label, pct30d: c.pct };
      if (!peorCohorte || c.pct < peorCohorte.pct30d) peorCohorte = { label: c.label, pct30d: c.pct };
    }
    const promedioUltimas8 =
      cohortesConSem4.length > 0
        ? Math.round(
            cohortesConSem4.reduce((a, b) => a + b.pct, 0) / cohortesConSem4.length,
          )
        : null;

    return {
      metrica,
      granularidad,
      cohortes,
      resumen: {
        mejorCohorte,
        peorCohorte,
        promedioUltimas8,
        targetPct: TARGET_RETENTION,
      },
    };
  } catch (err) {
    logger.error({ err, source: "cohortes-semanal" }, "Falla al calcular cohortes semanal");
    return {
      metrica,
      granularidad,
      cohortes: [],
      resumen: {
        mejorCohorte: null,
        peorCohorte: null,
        promedioUltimas8: null,
        targetPct: TARGET_RETENTION,
      },
    };
  }
}

async function contarActivos(
  metrica: MetricaCohorteSemanal,
  userIds: string[],
  desde: Date,
  hasta: Date,
): Promise<number> {
  if (metrica === "retention") {
    const rows = await prisma.eventoAnalitica.findMany({
      where: {
        evento: "$pageview",
        userId: { in: userIds },
        creadoEn: { gte: desde, lt: hasta },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.length;
  }
  if (metrica === "ftd") {
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
      SELECT DISTINCT "userId"
      FROM conversiones_afiliados
      WHERE tipo = 'FTD'
        AND "userId" IN (${Prisma.join(userIds)})
        AND "reportadoEn" >= ${desde}
        AND "reportadoEn" < ${hasta}
    `);
    return rows.length;
  }
  // socios
  const rows = await prisma.suscripcion.findMany({
    where: {
      usuarioId: { in: userIds },
      activa: true,
      iniciada: { lt: hasta },
      OR: [{ vencimiento: null }, { vencimiento: { gt: desde } }],
    },
    select: { usuarioId: true },
    distinct: ["usuarioId"],
  });
  return rows.length;
}

/** Categoría visual del % para colorear cohort-cell. */
export function categoriaCohorteCell(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= 80) return "c-100";
  if (pct >= 50) return "c-80";
  if (pct >= 35) return "c-60";
  if (pct >= 20) return "c-40";
  if (pct >= 10) return "c-20";
  if (pct >= 1) return "c-10";
  return "";
}
