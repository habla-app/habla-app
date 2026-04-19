// Mapper api-football ↔ modelo Partido (Prisma). Traduce el shape externo
// al shape interno que persiste la app.
//
// Regla de oro: el `externalId` siempre es el `fixture.id` de api-football,
// como string. Es la clave única para upserts.

import type { Partido } from "@habla/db";
import type { ApiFootballFixture } from "./api-football.client";
import { mapRoundToEs } from "../utils/round-mapper";

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
  btts: boolean | null;
  mas25Goles: boolean | null;
  round: string | null;
  venue: string | null;
}

export function fixtureToPartidoInput(
  fixture: ApiFootballFixture,
): PartidoUpsertInput {
  const estado = mapEstadoPartido(fixture.fixture.status.short);
  const golesLocal = fixture.goals.home;
  const golesVisita = fixture.goals.away;

  // Sólo derivamos btts / mas25Goles cuando el partido está FINALIZADO y
  // el marcador está completo. Durante EN_VIVO no es seguro: un partido
  // 0-2 al HT puede terminar 1-2 y flipear mas25Goles de false→true; btts
  // puede pasar de false→true igual. Dejamos null hasta que el status
  // sea final. huboTarjetaRoja requiere /fixtures/events y se llena en
  // el poller del Sub-Sprint 5.
  const finalizado =
    estado === "FINALIZADO" && golesLocal !== null && golesVisita !== null;
  const btts = finalizado ? golesLocal! > 0 && golesVisita! > 0 : null;
  const mas25Goles = finalizado ? golesLocal! + golesVisita! > 2 : null;

  const venueName = fixture.fixture.venue?.name ?? null;
  const venueCity = fixture.fixture.venue?.city ?? null;
  const venue = venueName
    ? [venueName, venueCity].filter(Boolean).join(", ")
    : null;

  return {
    externalId: String(fixture.fixture.id),
    liga: fixture.league.name,
    equipoLocal: fixture.teams.home.name,
    equipoVisita: fixture.teams.away.name,
    fechaInicio: new Date(fixture.fixture.date),
    estado,
    golesLocal,
    golesVisita,
    btts,
    mas25Goles,
    round: mapRoundToEs(fixture.league.round),
    venue,
  };
}
