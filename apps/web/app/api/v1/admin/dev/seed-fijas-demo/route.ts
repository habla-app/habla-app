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
import { listarFijas } from "@/lib/services/las-fijas.service";
import { obtenerListaLiga } from "@/lib/services/liga.service";
import { calcularPuntosTicket } from "@/lib/services/puntuacion.service";

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
  {
    // Partido FINALIZADO ayer — alimenta `RankingMensualTabla` (que requiere
    // tickets con puntosFinales sobre torneos FINALIZADO). Ver mockup line
    // 3469 (Arsenal 2-1 Fulham · "+12 pts" · top tipster @cracker_lima 19pts).
    externalId: `${DEMO_PREFIX}7`,
    liga: "Premier League",
    equipoLocal: "Arsenal",
    equipoVisita: "Fulham",
    fechaOffsetHoras: -24, // ayer
    estado: "FINALIZADO",
    golesLocal: 2,
    golesVisita: 1,
    liveElapsed: 90,
    liveStatusShort: "FT",
    round: "26ma fecha",
    pronostico: "LOCAL",
    probabilidades: { local: 0.55, empate: 0.25, visita: 0.2 },
    mejorCuota: { mercado: "LOCAL", cuota: 1.85, casa: "Betano" },
    cuotasReferenciales: {
      local: 1.85,
      empate: 3.6,
      visita: 4.2,
      over25: 1.7,
      under25: 2.1,
      bttsSi: 1.62,
      bttsNo: 2.25,
      bestCasa: "Betano",
      bestSigla: "BT",
      bestColor: "#DC2626",
    },
    analisisBasico:
      "Forma reciente últimos 5 local: G G G E G.\n" +
      "Forma reciente últimos 5 visita: P E P P G.\n" +
      "Cara a cara últimos 5: 4 victorias del local, 1 empate, 0 victorias del visita. Promedio de goles por partido 2.6.\n" +
      "Lesiones local: 1 lesionado (no titular).\n" +
      "Lesiones visita: 2 lesionados.",
    combinadaOptima: null,
    analisisGoles: null,
    analisisTarjetas: null,
    mercadosSecundarios: [],
    razonamiento: "",
    elegibleLiga: true,
  },
];

// ---------------------------------------------------------------------------
// Tipsters demo — Parche 3
// ---------------------------------------------------------------------------
// 20 usuarios fake identificables por prefijo en email + username. Cada uno
// se inscribe en cada Torneo elegible para Liga, con predicciones
// determinísticas (semilla = índice). Tickets sobre torneos FINALIZADO
// reciben puntos calculados con `calcularPuntosTicket()` (mismo algoritmo
// del motor real) — alimenta `RankingMensualTabla` (que requiere
// `puntosFinales` sobre torneos FINALIZADO).
// Tickets sobre EN_VIVO también reciben puntos parciales — alimenta
// `RankingPaginado` de /liga/[slug].
// Tickets sobre PROGRAMADO quedan en cero — esperan kickoff.

const TIPSTER_EMAIL_PREFIX = "demo_tipster_";
const TIPSTER_EMAIL_DOMAIN = "@hablademo.local";
const TIPSTER_USERNAME_PREFIX = "demo_tipster_";
const TIPSTERS_DEMO_COUNT = 20;

// Ciudades para variar el campo `ubicacion`. Sin valor de negocio — solo
// para que la lista de tipsters tenga diversidad visual.
const CIUDADES_DEMO = [
  "Lima",
  "Arequipa",
  "Trujillo",
  "Cusco",
  "Piura",
  "Chiclayo",
  "Iquitos",
  "Huaral",
  "Tacna",
  "Huancavelica",
];

interface TipsterDemo {
  idx: number; // 1..N
  email: string;
  username: string;
  nombre: string;
  ubicacion: string;
}

function tipstersDemo(): TipsterDemo[] {
  return Array.from({ length: TIPSTERS_DEMO_COUNT }, (_, i) => {
    const idx = i + 1;
    const padded = String(idx).padStart(2, "0");
    return {
      idx,
      email: `${TIPSTER_EMAIL_PREFIX}${padded}${TIPSTER_EMAIL_DOMAIN}`,
      username: `${TIPSTER_USERNAME_PREFIX}${padded}`,
      nombre: `Tipster Demo ${padded}`,
      ubicacion: CIUDADES_DEMO[i % CIUDADES_DEMO.length]!,
    };
  });
}

// PRNG determinístico — mismo seed produce siempre las mismas predicciones.
// `mulberry32` con seed combinado de tipsterIdx + partidoIdx.
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PredsGeneradas {
  predResultado: "LOCAL" | "EMPATE" | "VISITA";
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

/**
 * Predicciones determinísticas para un tipster sobre un partido demo. El
 * algoritmo "biases" un porcentaje de tipsters hacia el pronóstico Habla!
 * (≈55% acierta el resultado) — refleja un mercado donde el favorito
 * suele ganar más de la mitad de las veces.
 */
function generarPredicciones(
  tipsterIdx: number,
  partidoIdx: number,
  pronostico: "LOCAL" | "EMPATE" | "VISITA",
): PredsGeneradas {
  const r = rng(tipsterIdx * 1000 + partidoIdx);
  const aciertaResultado = r() < 0.55; // 55% acierta resultado
  const predResultado = aciertaResultado
    ? pronostico
    : (() => {
        const otros = (
          ["LOCAL", "EMPATE", "VISITA"] as const
        ).filter((x) => x !== pronostico);
        return otros[Math.floor(r() * otros.length)]!;
      })();
  return {
    predResultado,
    predBtts: r() < 0.5,
    predMas25: r() < 0.55, // ligero sesgo a más-2.5
    predTarjetaRoja: r() < 0.25, // 25% predice "sí roja"
    predMarcadorLocal: Math.floor(r() * 4), // 0-3
    predMarcadorVisita: Math.floor(r() * 4),
  };
}

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

    // -----------------------------------------------------------------
    // Sembrar tipsters demo + tickets — alimenta los rankings.
    // -----------------------------------------------------------------
    const tipsters = tipstersDemo();
    let tipstersCreados = 0;
    let tipstersActualizados = 0;

    const tipstersResueltos: { idx: number; userId: string }[] = [];
    for (const t of tipsters) {
      const existente = await prisma.usuario.findUnique({
        where: { email: t.email },
        select: { id: true },
      });
      if (existente) {
        await prisma.usuario.update({
          where: { id: existente.id },
          data: {
            nombre: t.nombre,
            username: t.username,
            ubicacion: t.ubicacion,
            tycAceptadosAt: ahora,
            verificado: true,
            usernameLocked: true,
          },
        });
        tipstersResueltos.push({ idx: t.idx, userId: existente.id });
        tipstersActualizados += 1;
      } else {
        const creado = await prisma.usuario.create({
          data: {
            email: t.email,
            nombre: t.nombre,
            username: t.username,
            ubicacion: t.ubicacion,
            tycAceptadosAt: ahora,
            verificado: true,
            usernameLocked: true,
            rol: "JUGADOR",
          },
          select: { id: true },
        });
        tipstersResueltos.push({ idx: t.idx, userId: creado.id });
        tipstersCreados += 1;
      }
    }

    // Releer torneos elegibles (ya creados arriba) + sus partidos para
    // calcular puntos.
    const torneosElegibles = await prisma.torneo.findMany({
      where: {
        partido: { externalId: { startsWith: DEMO_PREFIX } },
        estado: { not: "CANCELADO" },
      },
      include: {
        partido: {
          select: {
            externalId: true,
            estado: true,
            golesLocal: true,
            golesVisita: true,
            btts: true,
            mas25Goles: true,
            huboTarjetaRoja: true,
          },
        },
      },
    });

    let ticketsCreados = 0;
    let ticketsActualizados = 0;

    for (const torneo of torneosElegibles) {
      const partidoIdx = parseInt(
        torneo.partido.externalId.replace(DEMO_PREFIX, ""),
        10,
      );
      const fija = FIJAS_DEMO.find(
        (f) => f.externalId === torneo.partido.externalId,
      );
      if (!fija) continue;
      const esLive = torneo.partido.estado === "EN_VIVO";
      const esFin = torneo.partido.estado === "FINALIZADO";

      const snapshotPartido = {
        golesLocal: torneo.partido.golesLocal,
        golesVisita: torneo.partido.golesVisita,
        btts: torneo.partido.btts,
        mas25Goles: torneo.partido.mas25Goles,
        huboTarjetaRoja: torneo.partido.huboTarjetaRoja,
        estado: torneo.partido.estado,
      };

      for (const t of tipstersResueltos) {
        const preds = generarPredicciones(t.idx, partidoIdx, fija.pronostico);
        const puntos =
          esLive || esFin ? calcularPuntosTicket(preds, snapshotPartido) : null;

        const ticketExistente = await prisma.ticket.findFirst({
          where: { usuarioId: t.userId, torneoId: torneo.id },
          select: { id: true },
        });

        const dataBase = {
          predResultado: preds.predResultado,
          predBtts: preds.predBtts,
          predMas25: preds.predMas25,
          predTarjetaRoja: preds.predTarjetaRoja,
          predMarcadorLocal: preds.predMarcadorLocal,
          predMarcadorVisita: preds.predMarcadorVisita,
          puntosTotal: puntos?.total ?? 0,
          puntosResultado: puntos?.resultado ?? 0,
          puntosBtts: puntos?.btts ?? 0,
          puntosMas25: puntos?.mas25 ?? 0,
          puntosTarjeta: puntos?.tarjeta ?? 0,
          puntosMarcador: puntos?.marcador ?? 0,
          // FIN: setea puntosFinales (alimenta el leaderboard mensual).
          puntosFinales: esFin ? puntos?.total ?? 0 : null,
        };

        if (ticketExistente) {
          await prisma.ticket.update({
            where: { id: ticketExistente.id },
            data: dataBase,
          });
          ticketsActualizados += 1;
        } else {
          await prisma.ticket.create({
            data: {
              ...dataBase,
              usuarioId: t.userId,
              torneoId: torneo.id,
            },
          });
          ticketsCreados += 1;
        }
      }

      // Actualizar `totalInscritos` del torneo al conteo real.
      const conteo = await prisma.ticket.count({
        where: { torneoId: torneo.id },
      });
      await prisma.torneo.update({
        where: { id: torneo.id },
        data: { totalInscritos: conteo },
      });
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "dev.seed_fijas_demo.crear",
      entidad: "Partido",
      entidadId: "dev-seed",
      resumen: `Sembrados ${FIJAS_DEMO.length} partidos demo + análisis aprobados${
        torneosCreados > 0 ? ` + ${torneosCreados} torneos` : ""
      } + ${tipstersCreados + tipstersActualizados} tipsters + ${ticketsCreados + ticketsActualizados} tickets`,
      metadata: {
        creados,
        actualizados,
        torneosCreados,
        tipstersCreados,
        tipstersActualizados,
        ticketsCreados,
        ticketsActualizados,
        externalIds: FIJAS_DEMO.map((f) => f.externalId),
      },
    });

    logger.info(
      {
        creados,
        actualizados,
        torneosCreados,
        tipstersCreados,
        tipstersActualizados,
        ticketsCreados,
        ticketsActualizados,
      },
      "POST /api/v1/admin/dev/seed-fijas-demo OK",
    );

    return Response.json({
      data: {
        ok: true,
        creados,
        actualizados,
        torneosCreados,
        tipstersCreados,
        tipstersActualizados,
        ticketsCreados,
        ticketsActualizados,
        externalIds: FIJAS_DEMO.map((f) => f.externalId),
        mensaje: `${FIJAS_DEMO.length} partidos demo + ${tipstersCreados + tipstersActualizados} tipsters + ${ticketsCreados + ticketsActualizados} tickets. Para limpiar, hacé DELETE al mismo endpoint.`,
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

    // Tipsters demo (independientes — pueden existir aunque no haya partidos).
    const tipstersDemoEnBD = await prisma.usuario.findMany({
      where: { email: { startsWith: TIPSTER_EMAIL_PREFIX } },
      select: { id: true, email: true },
    });

    if (partidosDemo.length === 0 && tipstersDemoEnBD.length === 0) {
      return Response.json({
        data: {
          ok: true,
          partidosEliminados: 0,
          tipstersEliminados: 0,
          mensaje: "No había datos demo para eliminar.",
        },
      });
    }

    const partidoIds = partidosDemo.map((p) => p.id);
    const tipsterIds = tipstersDemoEnBD.map((t) => t.id);

    // Borrar en orden — primero relaciones (Ticket), después contenedores
    // (Torneo, Partido, Usuario).
    await prisma.$transaction(async (tx) => {
      // Tickets: tanto los de torneos demo como los de tipsters demo (por
      // si un tipster demo se inscribió en un torneo no-demo, aunque no
      // debería pasar).
      await tx.ticket.deleteMany({
        where: {
          OR: [
            ...(partidoIds.length
              ? [{ torneo: { partidoId: { in: partidoIds } } }]
              : []),
            ...(tipsterIds.length ? [{ usuarioId: { in: tipsterIds } }] : []),
          ],
        },
      });
      if (partidoIds.length) {
        await tx.torneo.deleteMany({
          where: { partidoId: { in: partidoIds } },
        });
        // AnalisisPartido tiene onDelete: Cascade — se borra solo.
        // EventoPartido también tiene onDelete: Cascade.
        await tx.partido.deleteMany({ where: { id: { in: partidoIds } } });
      }
      if (tipsterIds.length) {
        // Las dependencias del Usuario que NO tienen onDelete: Cascade
        // bloquean el delete. Limpiamos las opcionales para los tipsters
        // demo (son fake — no tienen sesiones, suscripciones, etc.).
        await tx.session.deleteMany({
          where: { userId: { in: tipsterIds } },
        });
        await tx.account.deleteMany({
          where: { userId: { in: tipsterIds } },
        });
        await tx.usuario.deleteMany({ where: { id: { in: tipsterIds } } });
      }
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "dev.seed_fijas_demo.eliminar",
      entidad: "Partido",
      entidadId: "dev-seed",
      resumen: `Eliminados ${partidosDemo.length} partidos demo + ${tipstersDemoEnBD.length} tipsters demo`,
      metadata: {
        partidosEliminados: partidosDemo.length,
        tipstersEliminados: tipstersDemoEnBD.length,
        externalIds: partidosDemo.map((p) => p.externalId),
        tipsterEmails: tipstersDemoEnBD.map((t) => t.email),
      },
    });

    logger.info(
      {
        partidosEliminados: partidosDemo.length,
        tipstersEliminados: tipstersDemoEnBD.length,
      },
      "DELETE /api/v1/admin/dev/seed-fijas-demo OK",
    );

    return Response.json({
      data: {
        ok: true,
        partidosEliminados: partidosDemo.length,
        tipstersEliminados: tipstersDemoEnBD.length,
        externalIds: partidosDemo.map((p) => p.externalId),
        mensaje: `${partidosDemo.length} partidos + ${tipstersDemoEnBD.length} tipsters demo eliminados (con sus tickets, torneos y análisis).`,
      },
    });
  } catch (err) {
    logger.error({ err }, "DELETE /api/v1/admin/dev/seed-fijas-demo falló");
    return toErrorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// GET — Diagnóstico
// ---------------------------------------------------------------------------
//
// Retorna conteos de partidos demo en BD y de partidos que matchean los
// filtros de las vistas /las-fijas y /liga. Sirve para verificar si el
// seed dejó los datos como esperamos vs si hay algún disconnect entre
// seed y query.

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden consultar el diagnóstico.",
      );
    }

    const partidosDemo = await prisma.partido.findMany({
      where: { externalId: { startsWith: DEMO_PREFIX } },
      select: {
        id: true,
        externalId: true,
        liga: true,
        equipoLocal: true,
        equipoVisita: true,
        fechaInicio: true,
        estado: true,
        mostrarAlPublico: true,
        elegibleLiga: true,
        visibilidadOverride: true,
        analisisPartido: {
          select: {
            estado: true,
            inputsJSON: true,
          },
        },
        torneos: {
          select: { id: true, estado: true, totalInscritos: true },
        },
      },
    });

    const ahora = new Date();
    const en7dLimite = new Date(
      ahora.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    const detalle = partidosDemo.map((p) => {
      const inputs =
        p.analisisPartido?.inputsJSON &&
        typeof p.analisisPartido.inputsJSON === "object" &&
        p.analisisPartido.inputsJSON !== null
          ? (p.analisisPartido.inputsJSON as Record<string, unknown>)
          : null;
      const tieneCuotasReferenciales = !!(
        inputs && inputs.cuotasReferenciales
      );
      const torneoNoCancelado =
        p.torneos.find((t) => t.estado !== "CANCELADO") ?? null;

      // Replica del query de listarFijas() (mostrarAlPublico=true + ventana
      // 3h atrás/14d adelante).
      const ventanaLasFijas =
        p.fechaInicio.getTime() >= ahora.getTime() - 3 * 60 * 60 * 1000 &&
        p.fechaInicio.getTime() <= ahora.getTime() + 14 * 24 * 60 * 60 * 1000;
      const apareceEnLasFijas =
        p.mostrarAlPublico &&
        ["PROGRAMADO", "EN_VIVO", "FINALIZADO"].includes(p.estado) &&
        ventanaLasFijas;

      // Replica del query de obtenerListaLiga() (elegibleLiga + visibilidad
      // 7d + estado).
      const visibilidadOk =
        p.visibilidadOverride !== "forzar_oculto" &&
        (p.fechaInicio < en7dLimite ||
          p.visibilidadOverride === "forzar_visible");
      const apareceEnLigaProximos =
        p.elegibleLiga &&
        p.estado === "PROGRAMADO" &&
        p.fechaInicio > ahora &&
        visibilidadOk;
      const apareceEnLigaEnVivo =
        p.elegibleLiga &&
        p.estado === "EN_VIVO" &&
        p.visibilidadOverride !== "forzar_oculto";
      const apareceEnLigaTerminados =
        p.elegibleLiga &&
        p.estado === "FINALIZADO" &&
        p.fechaInicio.getTime() >= ahora.getTime() - 7 * 24 * 60 * 60 * 1000 &&
        p.visibilidadOverride !== "forzar_oculto";

      return {
        externalId: p.externalId,
        partido: `${p.equipoLocal} vs ${p.equipoVisita}`,
        liga: p.liga,
        fechaInicio: p.fechaInicio.toISOString(),
        offsetHorasDesdeAhora:
          Math.round(
            ((p.fechaInicio.getTime() - ahora.getTime()) / 3600000) * 10,
          ) / 10,
        estado: p.estado,
        mostrarAlPublico: p.mostrarAlPublico,
        elegibleLiga: p.elegibleLiga,
        visibilidadOverride: p.visibilidadOverride,
        analisisEstado: p.analisisPartido?.estado ?? null,
        tieneCuotasReferenciales,
        torneoActivo: torneoNoCancelado
          ? {
              id: torneoNoCancelado.id,
              estado: torneoNoCancelado.estado,
              totalInscritos: torneoNoCancelado.totalInscritos,
            }
          : null,
        // Resultados de los filtros (qué vistas debería aparecer):
        deberiaAparecerEn: {
          lasFijasLista: apareceEnLasFijas,
          ligaProximos: apareceEnLigaProximos,
          ligaEnVivo: apareceEnLigaEnVivo,
          ligaTerminados: apareceEnLigaTerminados,
        },
      };
    });

    // Conteos agregados.
    const resumen = {
      partidosDemo: partidosDemo.length,
      conMostrarAlPublico: partidosDemo.filter((p) => p.mostrarAlPublico).length,
      conElegibleLiga: partidosDemo.filter((p) => p.elegibleLiga).length,
      porEstado: {
        PROGRAMADO: partidosDemo.filter((p) => p.estado === "PROGRAMADO").length,
        EN_VIVO: partidosDemo.filter((p) => p.estado === "EN_VIVO").length,
        FINALIZADO: partidosDemo.filter((p) => p.estado === "FINALIZADO").length,
        CANCELADO: partidosDemo.filter((p) => p.estado === "CANCELADO").length,
      },
      conAnalisisAprobado: partidosDemo.filter(
        (p) => p.analisisPartido?.estado === "APROBADO",
      ).length,
      conCuotasReferenciales: detalle.filter((d) => d.tieneCuotasReferenciales)
        .length,
      conTorneoActivo: detalle.filter((d) => d.torneoActivo !== null).length,
      // Conteos del filtro de cada vista.
      apareceEnLasFijas: detalle.filter((d) => d.deberiaAparecerEn.lasFijasLista)
        .length,
      apareceEnLigaProximos: detalle.filter(
        (d) => d.deberiaAparecerEn.ligaProximos,
      ).length,
      apareceEnLigaEnVivo: detalle.filter((d) => d.deberiaAparecerEn.ligaEnVivo)
        .length,
      apareceEnLigaTerminados: detalle.filter(
        (d) => d.deberiaAparecerEn.ligaTerminados,
      ).length,
    };

    // Tickets en torneos demo (alimenta ranking).
    const torneoIds = partidosDemo
      .flatMap((p) => p.torneos.map((t) => t.id))
      .filter((id): id is string => Boolean(id));
    const ticketsCount = torneoIds.length
      ? await prisma.ticket.count({
          where: { torneoId: { in: torneoIds } },
        })
      : 0;

    // Tipsters demo y sus tickets (separados de torneos demo, para
    // distinguir "tipsters huérfanos" de "tipsters con tickets activos").
    const tipstersDemoEnBD = await prisma.usuario.count({
      where: { email: { startsWith: TIPSTER_EMAIL_PREFIX } },
    });
    const ticketsDeTipstersDemo = await prisma.ticket.count({
      where: { usuario: { email: { startsWith: TIPSTER_EMAIL_PREFIX } } },
    });
    const ticketsConPuntosFinales = await prisma.ticket.count({
      where: {
        usuario: { email: { startsWith: TIPSTER_EMAIL_PREFIX } },
        puntosFinales: { not: null },
      },
    });

    // ----- Llamadas REALES a los servicios -----
    // Si los conteos del resumen JS-side dicen que X partidos deberían
    // aparecer pero los servicios reales devuelven 0, hay un disconnect
    // entre la replicación JS de los filtros y lo que Prisma realmente
    // ejecuta. Estos números son la verdad operacional.
    const fijasReales = await listarFijas().catch((e: Error) => ({
      error: e.message,
    }));
    const ligaReal = await obtenerListaLiga(session.user.id).catch(
      (e: Error) => ({ error: e.message }),
    );

    const serviciosReales = {
      listarFijas: Array.isArray(fijasReales)
        ? {
            total: fijasReales.length,
            externalIds: [], // FijaListItem no expone externalId; usamos partido
            partidos: fijasReales.map(
              (f) => `${f.equipoLocal} vs ${f.equipoVisita}`,
            ),
            partidosDemoIncluidos: fijasReales.filter((f) =>
              partidosDemo.some(
                (d) =>
                  d.equipoLocal === f.equipoLocal &&
                  d.equipoVisita === f.equipoVisita,
              ),
            ).length,
          }
        : fijasReales,
      obtenerListaLiga:
        "proximos" in ligaReal
          ? {
              proximos: {
                total: ligaReal.proximos.length,
                partidos: ligaReal.proximos.map(
                  (p) => `${p.equipoLocal} vs ${p.equipoVisita}`,
                ),
              },
              enVivo: {
                total: ligaReal.enVivo.length,
                partidos: ligaReal.enVivo.map(
                  (p) => `${p.equipoLocal} vs ${p.equipoVisita}`,
                ),
              },
              terminados: {
                total: ligaReal.terminados.length,
                partidos: ligaReal.terminados.map(
                  (p) => `${p.equipoLocal} vs ${p.equipoVisita}`,
                ),
              },
            }
          : ligaReal,
    };

    // Para detectar discrepancias entre los flags directos del partido y
    // un raw query equivalente (descarta posible bug de visibilidadWhere).
    const proximosRaw = await prisma.partido.count({
      where: {
        elegibleLiga: true,
        estado: "PROGRAMADO",
        fechaInicio: { gt: ahora },
      },
    });
    const proximosRawDemoSolo = await prisma.partido.count({
      where: {
        elegibleLiga: true,
        estado: "PROGRAMADO",
        fechaInicio: { gt: ahora },
        externalId: { startsWith: DEMO_PREFIX },
      },
    });

    return Response.json({
      data: {
        ok: true,
        ahora: ahora.toISOString(),
        resumen: {
          ...resumen,
          ticketsEnTorneosDemo: ticketsCount,
          tipstersDemo: tipstersDemoEnBD,
          ticketsDeTipstersDemo,
          ticketsConPuntosFinales, // alimenta RankingMensualTabla
        },
        // Verdad operacional — qué devuelven los servicios que la página
        // usa. Si esto difiere de "resumen", hay un bug de query.
        serviciosReales,
        // Conteos crudos sin visibilidadWhere para aislar si ese filtro
        // es el culpable.
        rawCount: {
          proximosTotal: proximosRaw,
          proximosDemoSolo: proximosRawDemoSolo,
        },
        detalle,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/dev/seed-fijas-demo falló");
    return toErrorResponse(err);
  }
}
