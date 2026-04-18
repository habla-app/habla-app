// Mapper api-football ↔ modelo Partido (Prisma). Traduce el shape externo
// al shape interno que persiste la app.
//
// Regla de oro: el `externalId` siempre es el `fixture.id` de api-football,
// como string. Es la clave única para upserts.

import type { Partido } from "@habla/db";
import type { ApiFootballFixture } from "./api-football.client";

export type EstadoPartidoDb = Partido["estado"];

/**
 * Mapa de status.short de api-football → EstadoPartido de Habla!.
 * Ref: https://www.api-football.com/documentation-v3#tag/Fixtures
 */
export function mapEstadoPartido(shortStatus: string): EstadoPartidoDb {
  // Programado (Not Started, Time To Be Defined, Postponed)
  if (shortStatus === "NS" || shortStatus === "TBD" || shortStatus === "PST") {
    return "PROGRAMADO";
  }
  // Finalizado: Full Time, After Extra Time, Penalties Ended, Awarded
  if (
    shortStatus === "FT" ||
    shortStatus === "AET" ||
    shortStatus === "PEN" ||
    shortStatus === "AWD"
  ) {
    return "FINALIZADO";
  }
  // Cancelado / Abandoned / Walkover
  if (
    shortStatus === "CANC" ||
    shortStatus === "ABD" ||
    shortStatus === "WO"
  ) {
    return "CANCELADO";
  }
  // En vivo: 1H, 2H, HT, ET, BT, P, INT, SUSP
  return "EN_VIVO";
}

export interface PartidoUpsertInput {
  externalId: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
  estado: EstadoPartidoDb;
  golesLocal: number | null;
  golesVisita: number | null;
}

export function fixtureToPartidoInput(
  fixture: ApiFootballFixture,
): PartidoUpsertInput {
  return {
    externalId: String(fixture.fixture.id),
    liga: fixture.league.name,
    equipoLocal: fixture.teams.home.name,
    equipoVisita: fixture.teams.away.name,
    fechaInicio: new Date(fixture.fixture.date),
    estado: mapEstadoPartido(fixture.fixture.status.short),
    golesLocal: fixture.goals.home,
    golesVisita: fixture.goals.away,
  };
}
