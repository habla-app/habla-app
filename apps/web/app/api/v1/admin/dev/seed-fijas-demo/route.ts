// POST/DELETE /api/v1/admin/dev/seed-fijas-demo
//
// Endpoint admin one-shot para verificación visual del Lote T (las 4 vistas
// re-portadas del mockup v3.2). Crea 6 partidos demo identificables por
// `externalId` con prefijo "DEMO-FIJA-N" (N=1..6) + sus AnalisisPartido en
// estado APROBADO + 3 Torneos elegibles para Liga.
//
// Identificación: TODOS los registros sembrados llevan `externalId` con
// prefijo "DEMO-FIJA-" en `Partido`. Eso permite tirarlos limpiamente con
// el DELETE de este mismo endpoint sin tocar datos reales.
//
// Auth: rol ADMIN obligatorio. Auditoría 100% en POST y DELETE
// (regla 21 del CLAUDE.md).
//
// Cero migración. Cero deps nuevas. Una vez que el Lote O entregue
// /admin/partidos con UI completa, este endpoint puede borrarse junto al
// archivo entero — los datos de demo se limpian con DELETE primero.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, Prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const DEMO_PREFIX = "DEMO-FIJA-";
const PROMPT_VERSION_DEMO = "demo-v1";

// ---------------------------------------------------------------------------
// Datos demo basados en el mockup v3.2 (líneas 2596-2672 page-fijas-list,
// líneas 2778-3047 page-fijas-detail, líneas 3319-3346 + 3411-3424 page-liga-list).
// ---------------------------------------------------------------------------

interface FijaDemo {
  externalId: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaOffsetHoras: number; // relativo a "ahora"
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO";
  golesLocal: number | null;
  golesVisita: number | null;
  liveElapsed: number | null;
  liveStatusShort: string | null;
  round: string | null;
  pronostico: "LOCAL" | "EMPATE" | "VISITA";
  probabilidades: { local: number; empate: number; visita: number };
  mejorCuota: { mercado: "LOCAL" | "EMPATE" | "VISITA"; cuota: number; casa: string };
  /** Snapshot de cuotas referenciales (1X2 + ±2.5 + BTTS Sí/No + casa best).
   *  Se persiste en `inputsJSON.cuotasReferenciales` y lo lee `listarFijas()`
   *  para llenar la tabla densa de Las Fijas.
   *  Las claves del lado de Las Fijas: local/empate/visita/over25/under25/
   *  bttsSi/bttsNo, más bestCasa/bestSigla/bestColor. */
  cuotasReferenciales: {
    local: number;
    empate: number;
    visita: number;
    over25: number;
    under25: number;
    bttsSi: number;
    bttsNo: number;
    bestCasa: string;
    bestSigla: string;
    bestColor: string;
  };
  /** Texto formato literal-mockup. CADA bloque debe estar en una sola
   *  línea SIN newlines internos para que el regex de AnalisisBasicoCard
   *  los matchee (las regex ahí no atraviesan newlines).
   *  Bloques esperados:
   *    - "Forma reciente últimos 5 local: G G E G G."
   *    - "Forma reciente últimos 5 visita: P P G E G."
   *    - "Cara a cara últimos 5: 3 victorias del local, 1 empate, 1 victoria del visita. Promedio de goles por partido 3.2."
   *    - "Lesiones local: 2 lesionados (no titulares)."
   *    - "Lesiones visita: 3 titulares fuera (Bowen, Antonio, Kudus)."
   */
  analisisBasico: string;
  combinadaOptima: {
    mercados: { mercado: string; outcome: string; cuota: number; label: string }[];
    cuotaTotal: number;
    casa: string;
    stake: string;
    evPlus: number;
    confianza: number;
    razonamiento: string;
  } | null;
  analisisGoles: {
    goles_esperados_local: number;
    goles_esperados_visita: number;
    explicacion: string;
    factores: string[];
  } | null;
  analisisTarjetas: {
    tarjetas_esperadas_total: number;
    riesgo_roja: "BAJO" | "MEDIO" | "ALTO";
    explicacion: string;
    factores: string[];
  } | null;
  mercadosSecundarios: {
    mercado: string;
    cuota: number;
    value: number;
    casa: string;
  }[];
  razonamiento: string;
  elegibleLiga: boolean;
}

const FIJAS_DEMO: FijaDemo[] = [
  {
    externalId: `${DEMO_PREFIX}1`,
    liga: "Premier League",
    equipoLocal: "Brentford",
    equipoVisita: "West Ham",
    fechaOffsetHoras: 48 + 14, // ~2 días 14h adelante (mockup countdown 2d 14h 22m)
    estado: "PROGRAMADO",
    golesLocal: null,
    golesVisita: null,
    liveElapsed: null,
    liveStatusShort: null,
    round: "27ma fecha",
    pronostico: "LOCAL",
    probabilidades: { local: 0.47, empate: 0.28, visita: 0.25 },
    mejorCuota: { mercado: "LOCAL", cuota: 2.1, casa: "Betano" },
    cuotasReferenciales: {
      local: 2.1,
      empate: 3.3,
      visita: 3.4,
      over25: 1.85,
      under25: 1.95,
      bttsSi: 1.75,
      bttsNo: 2.05,
      bestCasa: "Betano",
      bestSigla: "BT",
      bestColor: "#DC2626",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: G G E G G.\n" +
      "Forma reciente últimos 5 visita: P P G E G.\n" +
      "Cara a cara últimos 5: 3 victorias del local, 1 empate, 1 victoria del visita. Promedio de goles por partido 3.2.\n" +
      "Lesiones local: 2 lesionados (no titulares).\n" +
      "Lesiones visita: 3 titulares fuera (Bowen, Antonio, Kudus).",
    combinadaOptima: {
      mercados: [
        { mercado: "1X2", outcome: "LOCAL", cuota: 2.1, label: "Local" },
        { mercado: "TOTAL", outcome: "MAS_2_5", cuota: 1.85, label: "Más 2.5" },
      ],
      cuotaTotal: 2.1,
      casa: "Betano",
      stake: "2% bankroll",
      evPlus: 8.4,
      confianza: 72,
      razonamiento:
        "Brentford ganó 4 de los últimos 5 en casa con promedio de 2.4 goles a favor. West Ham viene de 2 derrotas como visitante con 3 titulares fuera (Bowen, Antonio, Kudus) críticos para la generación ofensiva. H2H últimos 5: 3 victorias Brentford, 1 empate, 1 visita, promedio 3.2 goles. La cuota implícita en 2.10 (47.6%) es inferior a nuestro modelo (52.3%), value claro.",
    },
    analisisGoles: {
      goles_esperados_local: 1.9,
      goles_esperados_visita: 1.1,
      explicacion:
        "Modelo xG basado en últimos 10 partidos, ponderado por home/away. Brentford con xG 1.9 esperado vs xGA 1.1 de West Ham.",
      factores: [
        "Brentford promedia 2.4 goles a favor en casa",
        "West Ham concede 1.6 goles por partido como visitante en últimos 10",
        "3 titulares ofensivos de West Ham fuera (Bowen, Antonio, Kudus)",
      ],
    },
    analisisTarjetas: {
      tarjetas_esperadas_total: 4.2,
      riesgo_roja: "BAJO",
      explicacion:
        "Promedio H2H reciente bajo en tarjetas. Árbitro asignado tiene tarjetas/partido = 3.8.",
      factores: [
        "Promedio H2H = 3.6 tarjetas",
        "Árbitro: Anthony Taylor (3.8 tarjetas/partido)",
        "Sin rivalidades históricas que escalen el partido",
      ],
    },
    mercadosSecundarios: [
      { mercado: "BTTS Sí", cuota: 1.78, value: 4.2, casa: "Betsson" },
      { mercado: "+2.5 goles", cuota: 1.85, value: 5.8, casa: "Betano" },
    ],
    razonamiento:
      "Brentford ganó 4 de los últimos 5 en casa con promedio de 2.4 goles a favor. West Ham viene de 2 derrotas como visitante con 3 titulares fuera (Bowen, Antonio, Kudus) críticos para la generación ofensiva. H2H últimos 5: 3 victorias Brentford, 1 empate, 1 visita, promedio 3.2 goles. La cuota implícita en 2.10 (47.6%) es inferior a nuestro modelo (52.3%), value claro.",
    elegibleLiga: true,
  },
  {
    externalId: `${DEMO_PREFIX}2`,
    liga: "Liga 1 Perú",
    equipoLocal: "Universitario",
    equipoVisita: "Sport Boys",
    fechaOffsetHoras: -0.5, // arrancó hace 30 min — partido en minuto 30 1T
    estado: "EN_VIVO",
    golesLocal: 1,
    golesVisita: 0,
    liveElapsed: 30,
    liveStatusShort: "1H",
    round: "Fecha 12",
    pronostico: "LOCAL",
    probabilidades: { local: 0.5, empate: 0.28, visita: 0.22 },
    mejorCuota: { mercado: "LOCAL", cuota: 1.4, casa: "Te Apuesto" },
    cuotasReferenciales: {
      local: 1.4,
      empate: 4.5,
      visita: 7.0,
      over25: 2.1,
      under25: 1.7,
      bttsSi: 2.2,
      bttsNo: 1.65,
      bestCasa: "Te Apuesto",
      bestSigla: "TA",
      bestColor: "#DC2626",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: G G G E G.\n" +
      "Forma reciente últimos 5 visita: P E P P G.\n" +
      "Cara a cara últimos 5: 4 victorias del local, 1 empate. Promedio de goles por partido 2.4.\n" +
      "Lesiones local: 1 lesionado (no titular).\n" +
      "Lesiones visita: 2 titulares fuera.",
    combinadaOptima: null,
    analisisGoles: null,
    analisisTarjetas: null,
    mercadosSecundarios: [],
    razonamiento: "",
    elegibleLiga: true,
  },
  {
    externalId: `${DEMO_PREFIX}3`,
    liga: "La Liga",
    equipoLocal: "Osasuna",
    equipoVisita: "Barcelona",
    fechaOffsetHoras: 5,
    estado: "PROGRAMADO",
    golesLocal: null,
    golesVisita: null,
    liveElapsed: null,
    liveStatusShort: null,
    round: "Jornada 32",
    pronostico: "VISITA",
    probabilidades: { local: 0.13, empate: 0.19, visita: 0.68 },
    mejorCuota: { mercado: "VISITA", cuota: 1.42, casa: "Betsson" },
    cuotasReferenciales: {
      local: 7.5,
      empate: 5.0,
      visita: 1.42,
      over25: 1.55,
      under25: 2.4,
      bttsSi: 1.85,
      bttsNo: 1.95,
      bestCasa: "Betsson",
      bestSigla: "BS",
      bestColor: "#0EA5E9",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: E P G P P.\n" +
      "Forma reciente últimos 5 visita: G G G E G.\n" +
      "Cara a cara últimos 5: 1 victoria del local, 0 empates, 4 victorias del visita. Promedio de goles por partido 2.8.\n" +
      "Lesiones local: 0 lesionados destacados.\n" +
      "Lesiones visita: 1 lesionado (no titular).",
    combinadaOptima: {
      mercados: [
        { mercado: "1X2", outcome: "VISITA", cuota: 1.42, label: "Visita" },
      ],
      cuotaTotal: 1.42,
      casa: "Betsson",
      stake: "3% bankroll",
      evPlus: 6.1,
      confianza: 78,
      razonamiento:
        "Barcelona viene de 4 victorias en sus últimos 5 con promedio 2.4 goles. Osasuna en mala forma local (1 victoria en últimos 5). Cuota implícita 70.4% vs modelo 76.5%, value detectado.",
    },
    analisisGoles: {
      goles_esperados_local: 0.9,
      goles_esperados_visita: 2.3,
      explicacion: "Barcelona xG promedio 2.5, Osasuna xGA 1.6 en casa.",
      factores: [
        "Barcelona suma 4 victorias seguidas",
        "Osasuna ha perdido 3 de últimos 5 en casa",
      ],
    },
    analisisTarjetas: {
      tarjetas_esperadas_total: 4.8,
      riesgo_roja: "MEDIO",
      explicacion: "Árbitro estricto + Barcelona-Osasuna típicamente con polémica.",
      factores: ["H2H promedio 5.1 tarjetas", "Árbitro 4.2 tj/partido"],
    },
    mercadosSecundarios: [
      { mercado: "BTTS Sí", cuota: 1.62, value: 3.5, casa: "Coolbet" },
    ],
    razonamiento:
      "Barcelona viene de 4 victorias en sus últimos 5 con promedio 2.4 goles. Osasuna en mala forma local (1 victoria en últimos 5).",
    elegibleLiga: false,
  },
  {
    externalId: `${DEMO_PREFIX}4`,
    liga: "Liga 1 Perú",
    equipoLocal: "Alianza Lima",
    equipoVisita: "UCV Moquegua",
    fechaOffsetHoras: 11,
    estado: "PROGRAMADO",
    golesLocal: null,
    golesVisita: null,
    liveElapsed: null,
    liveStatusShort: null,
    round: "Fecha 12",
    pronostico: "LOCAL",
    probabilidades: { local: 0.62, empate: 0.22, visita: 0.16 },
    mejorCuota: { mercado: "LOCAL", cuota: 1.65, casa: "Te Apuesto" },
    cuotasReferenciales: {
      local: 1.65,
      empate: 3.8,
      visita: 4.5,
      over25: 2.05,
      under25: 1.75,
      bttsSi: 2.1,
      bttsNo: 1.7,
      bestCasa: "Te Apuesto",
      bestSigla: "TA",
      bestColor: "#DC2626",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: G G E G G.\n" +
      "Forma reciente últimos 5 visita: P P E P G.\n" +
      "Cara a cara últimos 5: 5 victorias del local, 0 empates, 0 victorias del visita. Promedio de goles por partido 2.6.\n" +
      "Lesiones local: 0 lesionados destacados.\n" +
      "Lesiones visita: 1 titular fuera.",
    combinadaOptima: null,
    analisisGoles: null,
    analisisTarjetas: null,
    mercadosSecundarios: [],
    razonamiento: "",
    elegibleLiga: true,
  },
  {
    externalId: `${DEMO_PREFIX}5`,
    liga: "Champions League",
    equipoLocal: "Real Madrid",
    equipoVisita: "Manchester City",
    fechaOffsetHoras: 36,
    estado: "PROGRAMADO",
    golesLocal: null,
    golesVisita: null,
    liveElapsed: null,
    liveStatusShort: null,
    round: "Cuartos · vuelta",
    pronostico: "LOCAL",
    probabilidades: { local: 0.4, empate: 0.27, visita: 0.33 },
    mejorCuota: { mercado: "LOCAL", cuota: 2.5, casa: "Betano" },
    cuotasReferenciales: {
      local: 2.5,
      empate: 3.4,
      visita: 2.75,
      over25: 1.62,
      under25: 2.3,
      bttsSi: 1.55,
      bttsNo: 2.45,
      bestCasa: "Betano",
      bestSigla: "BT",
      bestColor: "#DC2626",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: G G G E G.\n" +
      "Forma reciente últimos 5 visita: G G E G G.\n" +
      "Cara a cara últimos 5: 2 victorias del local, 1 empate, 2 victorias del visita. Promedio de goles por partido 3.4.\n" +
      "Lesiones local: 1 lesionado (no titular).\n" +
      "Lesiones visita: 2 lesionados.",
    combinadaOptima: {
      mercados: [
        { mercado: "TOTAL", outcome: "MAS_2_5", cuota: 1.62, label: "Más 2.5" },
      ],
      cuotaTotal: 1.62,
      casa: "Betano",
      stake: "2% bankroll",
      evPlus: 5.3,
      confianza: 70,
      razonamiento:
        "H2H promedio 3.4 goles, ambos equipos con xG > 2 en últimos 10. Bernabéu suele tener partidos abiertos en eliminatorias.",
    },
    analisisGoles: {
      goles_esperados_local: 1.8,
      goles_esperados_visita: 1.6,
      explicacion: "Modelo combinado xG ambos equipos.",
      factores: ["H2H promedio 3.4 goles", "Eliminatoria abierta"],
    },
    analisisTarjetas: null,
    mercadosSecundarios: [
      { mercado: "BTTS Sí", cuota: 1.55, value: 4.8, casa: "Coolbet" },
      { mercado: "+2.5 goles", cuota: 1.62, value: 5.3, casa: "Betano" },
    ],
    razonamiento:
      "H2H promedio 3.4 goles, ambos equipos con xG > 2 en últimos 10.",
    elegibleLiga: true,
  },
  {
    externalId: `${DEMO_PREFIX}6`,
    liga: "Serie A",
    equipoLocal: "Como",
    equipoVisita: "Napoli",
    fechaOffsetHoras: 33,
    estado: "PROGRAMADO",
    golesLocal: null,
    golesVisita: null,
    liveElapsed: null,
    liveStatusShort: null,
    round: "Jornada 28",
    pronostico: "VISITA",
    probabilidades: { local: 0.18, empate: 0.22, visita: 0.6 },
    mejorCuota: { mercado: "VISITA", cuota: 1.55, casa: "Coolbet" },
    cuotasReferenciales: {
      local: 5.5,
      empate: 3.8,
      visita: 1.55,
      over25: 1.7,
      under25: 2.15,
      bttsSi: 1.95,
      bttsNo: 1.85,
      bestCasa: "Coolbet",
      bestSigla: "CB",
      bestColor: "#059669",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: P E P G P.\n" +
      "Forma reciente últimos 5 visita: G G E G G.\n" +
      "Cara a cara últimos 5: 1 victoria del local, 1 empate, 3 victorias del visita. Promedio de goles por partido 2.8.\n" +
      "Lesiones local: 2 titulares fuera.\n" +
      "Lesiones visita: 0 lesionados destacados.",
    combinadaOptima: null,
    analisisGoles: null,
    analisisTarjetas: null,
    mercadosSecundarios: [],
    razonamiento: "",
    elegibleLiga: false,
  },
];

// ---------------------------------------------------------------------------
// POST — Sembrar
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden sembrar datos demo.");
    }

    const ahora = new Date();
    let creados = 0;
    let actualizados = 0;
    let torneosCreados = 0;

    for (const fija of FIJAS_DEMO) {
      const fechaInicio = new Date(
        ahora.getTime() + fija.fechaOffsetHoras * 60 * 60 * 1000,
      );

      const partido = await prisma.partido.upsert({
        where: { externalId: fija.externalId },
        create: {
          externalId: fija.externalId,
          liga: fija.liga,
          equipoLocal: fija.equipoLocal,
          equipoVisita: fija.equipoVisita,
          fechaInicio,
          estado: fija.estado,
          golesLocal: fija.golesLocal,
          golesVisita: fija.golesVisita,
          liveElapsed: fija.liveElapsed,
          liveStatusShort: fija.liveStatusShort,
          liveUpdatedAt: fija.estado === "EN_VIVO" ? ahora : null,
          round: fija.round,
          mostrarAlPublico: true,
          elegibleLiga: fija.elegibleLiga,
        },
        update: {
          liga: fija.liga,
          equipoLocal: fija.equipoLocal,
          equipoVisita: fija.equipoVisita,
          fechaInicio,
          estado: fija.estado,
          golesLocal: fija.golesLocal,
          golesVisita: fija.golesVisita,
          liveElapsed: fija.liveElapsed,
          liveStatusShort: fija.liveStatusShort,
          liveUpdatedAt: fija.estado === "EN_VIVO" ? ahora : null,
          round: fija.round,
          mostrarAlPublico: true,
          elegibleLiga: fija.elegibleLiga,
        },
      });

      // Determinar si es alta o update
      const yaTeniaAnalisis = await prisma.analisisPartido.findUnique({
        where: { partidoId: partido.id },
      });
      if (yaTeniaAnalisis) {
        actualizados += 1;
      } else {
        creados += 1;
      }

      const combinadaOptimaValue =
        fija.combinadaOptima !== null
          ? (fija.combinadaOptima as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      const analisisGolesValue =
        fija.analisisGoles !== null
          ? (fija.analisisGoles as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      const analisisTarjetasValue =
        fija.analisisTarjetas !== null
          ? (fija.analisisTarjetas as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      const mercadosSecundariosValue =
        fija.mercadosSecundarios.length > 0
          ? (fija.mercadosSecundarios as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      await prisma.analisisPartido.upsert({
        where: { partidoId: partido.id },
        create: {
          partidoId: partido.id,
          pronostico1x2: fija.pronostico,
          probabilidades: fija.probabilidades as Prisma.InputJsonValue,
          mejorCuota: fija.mejorCuota as unknown as Prisma.InputJsonValue,
          analisisBasico: fija.analisisBasico,
          combinadaOptima: combinadaOptimaValue,
          razonamiento: fija.razonamiento || null,
          analisisGoles: analisisGolesValue,
          analisisTarjetas: analisisTarjetasValue,
          mercadosSecundarios: mercadosSecundariosValue,
          estado: "APROBADO",
          promptVersion: PROMPT_VERSION_DEMO,
          inputsJSON: {
            demo: true,
            fechaSeed: ahora.toISOString(),
            cuotasReferenciales: fija.cuotasReferenciales,
          },
          aprobadoPor: session.user.id,
          aprobadoEn: ahora,
        },
        update: {
          pronostico1x2: fija.pronostico,
          probabilidades: fija.probabilidades as Prisma.InputJsonValue,
          mejorCuota: fija.mejorCuota as unknown as Prisma.InputJsonValue,
          analisisBasico: fija.analisisBasico,
          combinadaOptima: combinadaOptimaValue,
          razonamiento: fija.razonamiento || null,
          analisisGoles: analisisGolesValue,
          analisisTarjetas: analisisTarjetasValue,
          mercadosSecundarios: mercadosSecundariosValue,
          estado: "APROBADO",
          // Re-corremos seed: actualizamos inputsJSON también, para que las
          // cuotas referenciales se sincronicen aún si el seed previo no
          // las tenía.
          inputsJSON: {
            demo: true,
            fechaSeed: ahora.toISOString(),
            cuotasReferenciales: fija.cuotasReferenciales,
          },
          aprobadoPor: session.user.id,
          aprobadoEn: ahora,
          archivadoEn: null,
          rechazadoMotivo: null,
        },
      });

      // Torneo elegible para Liga (sólo si elegibleLiga = true).
      if (fija.elegibleLiga) {
        const torneoExistente = await prisma.torneo.findFirst({
          where: { partidoId: partido.id, estado: { not: "CANCELADO" } },
        });
        if (!torneoExistente) {
          await prisma.torneo.create({
            data: {
              nombre: `Liga Habla! · ${fija.equipoLocal} vs ${fija.equipoVisita}`,
              tipo: "ESTANDAR",
              partidoId: partido.id,
              cierreAt: fechaInicio,
              estado:
                fija.estado === "EN_VIVO"
                  ? "EN_JUEGO"
                  : fija.estado === "FINALIZADO"
                    ? "FINALIZADO"
                    : "ABIERTO",
              totalInscritos: 0,
            },
          });
          torneosCreados += 1;
        }
      }
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "dev.seed_fijas_demo.crear",
      entidad: "Partido",
      entidadId: "dev-seed",
      resumen: `Sembrados ${FIJAS_DEMO.length} partidos demo + análisis aprobados${
        torneosCreados > 0 ? ` + ${torneosCreados} torneos` : ""
      }`,
      metadata: {
        creados,
        actualizados,
        torneosCreados,
        externalIds: FIJAS_DEMO.map((f) => f.externalId),
      },
    });

    logger.info(
      { creados, actualizados, torneosCreados },
      "POST /api/v1/admin/dev/seed-fijas-demo OK",
    );

    return Response.json({
      data: {
        ok: true,
        creados,
        actualizados,
        torneosCreados,
        externalIds: FIJAS_DEMO.map((f) => f.externalId),
        mensaje:
          "6 partidos demo creados con AnalisisPartido APROBADO. Para limpiar, hacé DELETE al mismo endpoint.",
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/dev/seed-fijas-demo falló");
    return toErrorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Limpiar
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden limpiar datos demo.");
    }

    // Buscar todos los partidos demo por prefijo de externalId.
    const partidosDemo = await prisma.partido.findMany({
      where: { externalId: { startsWith: DEMO_PREFIX } },
      select: { id: true, externalId: true },
    });

    if (partidosDemo.length === 0) {
      return Response.json({
        data: {
          ok: true,
          eliminados: 0,
          mensaje: "No había partidos demo para eliminar.",
        },
      });
    }

    const partidoIds = partidosDemo.map((p) => p.id);

    // Borrar en orden — Tickets son blocker si existen, pero la regla del
    // demo es que no se inscriben usuarios reales. Si hubiera Tickets,
    // los borramos primero (cascade no aplica porque Torneo→Ticket es FK).
    await prisma.$transaction(async (tx) => {
      await tx.ticket.deleteMany({
        where: { torneo: { partidoId: { in: partidoIds } } },
      });
      await tx.torneo.deleteMany({
        where: { partidoId: { in: partidoIds } },
      });
      // AnalisisPartido tiene onDelete: Cascade desde Partido — se borra solo.
      // EventoPartido también tiene onDelete: Cascade.
      await tx.partido.deleteMany({
        where: { id: { in: partidoIds } },
      });
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "dev.seed_fijas_demo.eliminar",
      entidad: "Partido",
      entidadId: "dev-seed",
      resumen: `Eliminados ${partidosDemo.length} partidos demo + análisis + torneos`,
      metadata: {
        eliminados: partidosDemo.length,
        externalIds: partidosDemo.map((p) => p.externalId),
      },
    });

    logger.info(
      { eliminados: partidosDemo.length },
      "DELETE /api/v1/admin/dev/seed-fijas-demo OK",
    );

    return Response.json({
      data: {
        ok: true,
        eliminados: partidosDemo.length,
        externalIds: partidosDemo.map((p) => p.externalId),
        mensaje: `${partidosDemo.length} partidos demo + sus análisis + torneos eliminados.`,
      },
    });
  } catch (err) {
    logger.error({ err }, "DELETE /api/v1/admin/dev/seed-fijas-demo falló");
    return toErrorResponse(err);
  }
}
