// Servicio admin Verificación Top 10 — Lote O (May 2026).
//
// Lista los 10 primeros del leaderboard del mes en curso con su estado de
// elegibilidad para cobrar el premio. Decisión §1.3 + regla 28 del
// CLAUDE.md: el premio se paga por Yape como premio publicitario; los
// datos requeridos son nombre + yapeNumero. NO se captura DNI (la columna
// DNI del mockup queda como "No verificado" siempre porque la regla
// operativa lo prohíbe).
//
// El campo "Estado" se deriva server-side:
//   - "Listo" verde: tiene yapeNumero + email verificado + tyc aceptados.
//   - "⚠ Bloqueante" rojo: falta yapeNumero (sin él no puede cobrar).
//   - "Pendiente" amber: tiene yape pero falta algún otro check secundario
//     (email no verificado, T&C no aceptados, etc.).

import { prisma } from "@habla/db";
import { obtenerLeaderboardMesActual } from "./leaderboard.service";

export interface FilaTop10Verificacion {
  posicion: number;
  usuarioId: string;
  username: string;
  nombre: string;
  email: string;
  // Cada flag es uno de "ok" | "amber" | "rojo" — el render decide el pill.
  flags: {
    mayorEdad: "ok" | "amber" | "rojo";
    dni: "amber"; // siempre "No verificado" — política Yape-only.
    email: "ok" | "amber";
    telefono: "ok" | "amber" | "rojo";
    yape: "ok" | "rojo";
    tyc: "ok" | "amber";
  };
  yapeMetodo: string | null; // "Yape" / "PLIN" / "BBVA" / etc — siempre "Yape" si yapeNumero existe.
  estadoFinal: "Listo" | "Bloqueante" | "Falta DNI" | "Pendiente";
}

export interface VistaVerificacionTop10 {
  mesEtiqueta: string;
  cierreLabel: string;
  filas: FilaTop10Verificacion[];
  resumen: {
    verificados: number;
    bloqueantes: number;
    diasAlCierre: number;
    totalPremios: number; // 1250 fijo
  };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export async function obtenerVistaVerificacionTop10(): Promise<VistaVerificacionTop10> {
  const ahora = new Date();
  const inicioMesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const diasAlCierre = Math.max(0, Math.ceil((inicioMesSiguiente.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)));

  const lb = await obtenerLeaderboardMesActual({});
  const top10 = lb.filas.slice(0, 10);
  const ids = top10.map((f) => f.userId);

  const usuarios = ids.length > 0
    ? await prisma.usuario.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nombre: true,
          username: true,
          email: true,
          emailVerified: true,
          telefono: true,
          yapeNumero: true,
          tycAceptadosAt: true,
          fechaNac: true,
        },
      })
    : [];
  const byId = new Map(usuarios.map((u) => [u.id, u]));

  const filas: FilaTop10Verificacion[] = top10.map((row) => {
    const u = byId.get(row.userId);
    if (!u) {
      return {
        posicion: row.posicion,
        usuarioId: row.userId,
        username: row.username,
        nombre: "—",
        email: "—",
        flags: {
          mayorEdad: "amber",
          dni: "amber",
          email: "amber",
          telefono: "amber",
          yape: "rojo",
          tyc: "amber",
        },
        yapeMetodo: null,
        estadoFinal: "Bloqueante",
      };
    }
    const mayorEdad = (() => {
      if (!u.fechaNac) return "amber";
      const edad = (ahora.getTime() - u.fechaNac.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return edad >= 18 ? "ok" : "rojo";
    })();
    const emailFlag = u.emailVerified ? "ok" : "amber";
    const telefonoFlag = u.telefono ? "ok" : "amber";
    const yapeFlag: "ok" | "rojo" = u.yapeNumero ? "ok" : "rojo";
    const tycFlag = u.tycAceptadosAt ? "ok" : "amber";

    let estadoFinal: FilaTop10Verificacion["estadoFinal"];
    if (yapeFlag === "rojo") estadoFinal = "Bloqueante";
    else if (mayorEdad === "rojo") estadoFinal = "Bloqueante";
    else if (emailFlag === "amber" || telefonoFlag === "amber" || tycFlag === "amber" || mayorEdad === "amber") estadoFinal = "Pendiente";
    else estadoFinal = "Listo";

    return {
      posicion: row.posicion,
      usuarioId: u.id,
      username: u.username,
      nombre: u.nombre,
      email: u.email,
      flags: {
        mayorEdad,
        dni: "amber", // política Yape-only
        email: emailFlag,
        telefono: telefonoFlag,
        yape: yapeFlag,
        tyc: tycFlag,
      },
      yapeMetodo: u.yapeNumero ? "Yape" : null,
      estadoFinal,
    };
  });

  const verificados = filas.filter((f) => f.estadoFinal === "Listo").length;
  const bloqueantes = filas.filter((f) => f.estadoFinal === "Bloqueante").length;

  return {
    mesEtiqueta: `${capitalize(MESES[ahora.getMonth()])} ${ahora.getFullYear()}`,
    cierreLabel: `1 ${MESES_CORTOS[inicioMesSiguiente.getMonth()]} 00:01 PET`,
    filas,
    resumen: {
      verificados,
      bloqueantes,
      diasAlCierre,
      totalPremios: 1250,
    },
  };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
