// alarmas.service.ts — Sistema de alarmas. Lote G.
//
// Tres tipos:
//   - KPI_THRESHOLD   automáticas. Cron horario evalúa cada `AlarmaConfiguracion`
//                    habilitada y crea/desactiva alarmas idempotente.
//   - EVENTO_CRITICO  automáticas. Disparadas por hooks específicos del sistema
//                    (no implementadas todavía — slot reservado).
//   - MANUAL          creadas por admin desde /admin/alarmas como recordatorio.
//
// Reglas:
//   - Email al admin solo si severidad === CRITICAL (anti-spam).
//   - Idempotencia: el cron NO crea duplicados. Si ya hay alarma activa
//     con el mismo metricId + tipo KPI_THRESHOLD, sólo actualiza contexto.
//   - Auto-desactivación: si KPI vuelve dentro del threshold, el cron
//     marca activa=false con motivoDesactivacion='Auto-desactivada: KPI volvió a target'.
//   - Desactivación manual requiere motivo (logged en auditoría).

import { prisma, Prisma, type Alarma as AlarmaDB } from "@habla/db";
import { logger } from "./logger";
import { obtenerKPIPorId } from "./kpis-metadata";
import { obtenerValorKPIActual } from "./kpi-detalle.service";
import { enviarEmail } from "./email.service";

export type TipoAlarmaIn = "KPI_THRESHOLD" | "EVENTO_CRITICO" | "MANUAL";
export type SeveridadIn = "INFO" | "WARNING" | "CRITICAL";

export interface AlarmaFila {
  id: string;
  tipo: TipoAlarmaIn;
  severidad: SeveridadIn;
  titulo: string;
  descripcion: string;
  metricId: string | null;
  contexto: unknown;
  activa: boolean;
  desactivadaEn: Date | null;
  desactivadaPor: string | null;
  motivoDesactivacion: string | null;
  creadaEn: Date;
}

function mapAlarma(row: AlarmaDB): AlarmaFila {
  return {
    id: row.id,
    tipo: row.tipo,
    severidad: row.severidad,
    titulo: row.titulo,
    descripcion: row.descripcion,
    metricId: row.metricId,
    contexto: row.contexto,
    activa: row.activa,
    desactivadaEn: row.desactivadaEn,
    desactivadaPor: row.desactivadaPor,
    motivoDesactivacion: row.motivoDesactivacion,
    creadaEn: row.creadaEn,
  };
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function obtenerAlarmasActivas(): Promise<AlarmaFila[]> {
  const rows = await prisma.alarma.findMany({
    where: { activa: true },
    orderBy: [{ severidad: "asc" }, { creadaEn: "desc" }],
  });
  return rows.map(mapAlarma);
}

export async function contarAlarmasActivas(): Promise<number> {
  return prisma.alarma.count({ where: { activa: true } });
}

export interface ListarAlarmasInput {
  desde?: Date;
  hasta?: Date;
  tipo?: TipoAlarmaIn;
  soloDesactivadas?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listarHistoricoAlarmas(
  input: ListarAlarmasInput = {},
): Promise<{ rows: AlarmaFila[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, input.pageSize ?? 50));

  const where: Prisma.AlarmaWhereInput = {};
  if (input.tipo) where.tipo = input.tipo;
  if (input.soloDesactivadas) where.activa = false;
  if (input.desde || input.hasta) {
    where.creadaEn = {};
    if (input.desde) where.creadaEn.gte = input.desde;
    if (input.hasta) where.creadaEn.lte = input.hasta;
  }

  const [rows, total] = await Promise.all([
    prisma.alarma.findMany({
      where,
      orderBy: { creadaEn: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alarma.count({ where }),
  ]);
  return { rows: rows.map(mapAlarma), total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Configuración de thresholds
// ---------------------------------------------------------------------------

export interface AlarmaConfigFila {
  id: string;
  metricId: string;
  metricLabel: string;
  thresholdMin: number | null;
  thresholdMax: number | null;
  duracionMinutos: number;
  severidad: SeveridadIn;
  habilitada: boolean;
  notasInternas: string | null;
}

export async function obtenerConfigThresholds(): Promise<AlarmaConfigFila[]> {
  const rows = await prisma.alarmaConfiguracion.findMany({
    orderBy: { metricLabel: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    metricId: r.metricId,
    metricLabel: r.metricLabel,
    thresholdMin: r.thresholdMin,
    thresholdMax: r.thresholdMax,
    duracionMinutos: r.duracionMinutos,
    severidad: r.severidad,
    habilitada: r.habilitada,
    notasInternas: r.notasInternas,
  }));
}

export interface UpsertConfigInput {
  metricId: string;
  metricLabel: string;
  thresholdMin?: number | null;
  thresholdMax?: number | null;
  duracionMinutos?: number;
  severidad?: SeveridadIn;
  habilitada?: boolean;
  notasInternas?: string | null;
}

export async function upsertarConfigThreshold(
  input: UpsertConfigInput,
): Promise<AlarmaConfigFila> {
  const row = await prisma.alarmaConfiguracion.upsert({
    where: { metricId: input.metricId },
    create: {
      metricId: input.metricId,
      metricLabel: input.metricLabel,
      thresholdMin: input.thresholdMin ?? null,
      thresholdMax: input.thresholdMax ?? null,
      duracionMinutos: input.duracionMinutos ?? 60,
      severidad: input.severidad ?? "WARNING",
      habilitada: input.habilitada ?? true,
      notasInternas: input.notasInternas ?? null,
    },
    update: {
      metricLabel: input.metricLabel,
      thresholdMin: input.thresholdMin ?? null,
      thresholdMax: input.thresholdMax ?? null,
      duracionMinutos: input.duracionMinutos ?? 60,
      severidad: input.severidad ?? "WARNING",
      habilitada: input.habilitada ?? true,
      notasInternas: input.notasInternas ?? null,
    },
  });
  return {
    id: row.id,
    metricId: row.metricId,
    metricLabel: row.metricLabel,
    thresholdMin: row.thresholdMin,
    thresholdMax: row.thresholdMax,
    duracionMinutos: row.duracionMinutos,
    severidad: row.severidad,
    habilitada: row.habilitada,
    notasInternas: row.notasInternas,
  };
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export async function desactivarAlarma(
  id: string,
  motivo: string,
  desactivadaPor: string,
): Promise<AlarmaFila> {
  const row = await prisma.alarma.update({
    where: { id },
    data: {
      activa: false,
      desactivadaEn: new Date(),
      desactivadaPor,
      motivoDesactivacion: motivo,
    },
  });
  return mapAlarma(row);
}

export interface CrearAlarmaManualInput {
  titulo: string;
  descripcion: string;
  severidad?: SeveridadIn;
}

export async function crearAlarmaManual(
  input: CrearAlarmaManualInput,
): Promise<AlarmaFila> {
  const row = await prisma.alarma.create({
    data: {
      tipo: "MANUAL",
      severidad: input.severidad ?? "INFO",
      titulo: input.titulo,
      descripcion: input.descripcion,
    },
  });
  return mapAlarma(row);
}

export async function crearAlarmaEventoCritico(input: {
  titulo: string;
  descripcion: string;
  severidad?: SeveridadIn;
  contexto?: Record<string, unknown>;
}): Promise<AlarmaFila> {
  const row = await prisma.alarma.create({
    data: {
      tipo: "EVENTO_CRITICO",
      severidad: input.severidad ?? "CRITICAL",
      titulo: input.titulo,
      descripcion: input.descripcion,
      contexto: input.contexto
        ? (input.contexto as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
  if (row.severidad === "CRITICAL") {
    await enviarEmailAdminAlarma(mapAlarma(row));
  }
  return mapAlarma(row);
}

// ---------------------------------------------------------------------------
// Cron: evaluar thresholds cada hora
// ---------------------------------------------------------------------------

export interface EvaluarReporte {
  configuradas: number;
  evaluadas: number;
  alarmasNuevas: number;
  alarmasActualizadas: number;
  alarmasAutoDesactivadas: number;
  errores: number;
}

export async function evaluarAlarmas(): Promise<EvaluarReporte> {
  const reporte: EvaluarReporte = {
    configuradas: 0,
    evaluadas: 0,
    alarmasNuevas: 0,
    alarmasActualizadas: 0,
    alarmasAutoDesactivadas: 0,
    errores: 0,
  };

  const configs = await prisma.alarmaConfiguracion.findMany({
    where: { habilitada: true },
  });
  reporte.configuradas = configs.length;

  for (const cfg of configs) {
    try {
      const meta = obtenerKPIPorId(cfg.metricId);
      if (!meta || meta.pendienteCableado) continue;

      // Ventana basada en duracionMinutos: convertimos a horas para reusar
      // helper. Mínimo 1h.
      const horas = Math.max(1, Math.ceil(cfg.duracionMinutos / 60));
      const valorActual = await obtenerValorKPIActual(cfg.metricId, horas);
      reporte.evaluadas += 1;

      const fueraMin =
        cfg.thresholdMin !== null && valorActual !== null && valorActual < cfg.thresholdMin;
      const fueraMax =
        cfg.thresholdMax !== null && valorActual !== null && valorActual > cfg.thresholdMax;
      const fueraDeRango = fueraMin || fueraMax;

      if (fueraDeRango) {
        // Crear o actualizar alarma activa con metricId
        const existente = await prisma.alarma.findFirst({
          where: {
            metricId: cfg.metricId,
            tipo: "KPI_THRESHOLD",
            activa: true,
          },
        });
        const titulo = `${meta.label} fuera de threshold`;
        const direccion = fueraMin ? "abajo" : "arriba";
        const limite = fueraMin ? cfg.thresholdMin : cfg.thresholdMax;
        const descripcion = `Valor actual ${valorActual ?? "desconocido"} ${direccion} del threshold ${limite ?? "sin definir"}.`;
        const contexto = {
          metricId: cfg.metricId,
          valorActual,
          thresholdMin: cfg.thresholdMin,
          thresholdMax: cfg.thresholdMax,
          ventanaHoras: horas,
        };

        if (existente) {
          await prisma.alarma.update({
            where: { id: existente.id },
            data: {
              descripcion,
              contexto: contexto as Prisma.InputJsonValue,
              severidad: cfg.severidad,
            },
          });
          reporte.alarmasActualizadas += 1;
        } else {
          const nueva = await prisma.alarma.create({
            data: {
              tipo: "KPI_THRESHOLD",
              severidad: cfg.severidad,
              titulo,
              descripcion,
              metricId: cfg.metricId,
              contexto: contexto as Prisma.InputJsonValue,
            },
          });
          reporte.alarmasNuevas += 1;

          if (cfg.severidad === "CRITICAL") {
            await enviarEmailAdminAlarma(mapAlarma(nueva));
          }
        }
      } else {
        // Auto-desactivar alarmas activas para este metricId
        const result = await prisma.alarma.updateMany({
          where: {
            metricId: cfg.metricId,
            tipo: "KPI_THRESHOLD",
            activa: true,
          },
          data: {
            activa: false,
            desactivadaEn: new Date(),
            motivoDesactivacion: "Auto-desactivada: KPI volvió a target",
          },
        });
        reporte.alarmasAutoDesactivadas += result.count;
      }
    } catch (err) {
      reporte.errores += 1;
      logger.error(
        { err, metricId: cfg.metricId, source: "cron:evaluar-alarmas" },
        "evaluarAlarmas: fallo en config",
      );
    }
  }

  return reporte;
}

// ---------------------------------------------------------------------------
// Email al admin para alarmas CRITICAL
// ---------------------------------------------------------------------------

async function enviarEmailAdminAlarma(alarma: AlarmaFila): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    logger.warn(
      { source: "alarmas:email" },
      "ADMIN_ALERT_EMAIL/ADMIN_EMAIL no configurado, alarma CRITICAL no notificada",
    );
    return;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  try {
    await enviarEmail({
      to: adminEmail,
      subject: `🚨 Alarma CRITICAL · ${alarma.titulo}`,
      html: `<p><strong>Severidad:</strong> ${alarma.severidad}</p>
<p><strong>Tipo:</strong> ${alarma.tipo}</p>
<p><strong>Descripción:</strong></p>
<p>${alarma.descripcion}</p>
<p><a href="${baseUrl}/admin/alarmas">Ver y gestionar en /admin/alarmas →</a></p>`,
      text: `Alarma CRITICAL · ${alarma.titulo}\n\n${alarma.descripcion}\n\nGestionar en ${baseUrl}/admin/alarmas`,
    });
  } catch (err) {
    logger.error(
      { err, alarmaId: alarma.id, source: "alarmas:email" },
      "Email de alarma CRITICAL falló al enviarse",
    );
  }
}
