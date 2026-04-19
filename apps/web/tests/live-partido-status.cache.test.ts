// Tests del cache in-memory de estado en vivo (Hotfix #4 Bug #9).
// El poller escribe en cada tick; los consumers (endpoint /live/matches,
// page /live-match, emitirRankingUpdate) leen.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLiveStatus,
  getLiveStatus,
  setLiveStatus,
  __resetLiveStatusCacheForTests,
  SNAPSHOT_TTL_MS,
} from "@/lib/services/live-partido-status.cache";

describe("live-partido-status cache", () => {
  beforeEach(() => {
    __resetLiveStatusCacheForTests();
    vi.useRealTimers();
  });

  it("setLiveStatus guarda snapshot con label computado por el mapper", () => {
    const snap = setLiveStatus("partido_1", "2H", 67);
    expect(snap.partidoId).toBe("partido_1");
    expect(snap.statusShort).toBe("2H");
    expect(snap.minuto).toBe(67);
    expect(snap.label).toBe("67'"); // formatMinutoLabel('2H', 67)
  });

  it("setLiveStatus con HT → label 'ENT'", () => {
    const snap = setLiveStatus("partido_2", "HT", null);
    expect(snap.label).toBe("ENT");
  });

  it("setLiveStatus con FT → label 'FIN'", () => {
    const snap = setLiveStatus("partido_3", "FT", 90);
    expect(snap.label).toBe("FIN");
  });

  it("getLiveStatus devuelve el último snapshot escrito", () => {
    setLiveStatus("p1", "1H", 10);
    setLiveStatus("p1", "1H", 30);
    const snap = getLiveStatus("p1");
    expect(snap).not.toBeNull();
    expect(snap!.minuto).toBe(30);
    expect(snap!.label).toBe("30'");
  });

  it("getLiveStatus con partidoId no registrado → null", () => {
    expect(getLiveStatus("no_existe")).toBeNull();
  });

  it("snapshot expira a los SNAPSHOT_TTL_MS", () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-19T15:00:00Z");
    vi.setSystemTime(start);
    setLiveStatus("p_ttl", "2H", 50);
    expect(getLiveStatus("p_ttl")).not.toBeNull();

    // Avanza el reloj 11 min (> TTL 10 min)
    vi.setSystemTime(new Date(start.getTime() + SNAPSHOT_TTL_MS + 60_000));
    expect(getLiveStatus("p_ttl")).toBeNull();
  });

  it("clearLiveStatus remueve el snapshot específicamente", () => {
    setLiveStatus("p_clear", "1H", 20);
    expect(getLiveStatus("p_clear")).not.toBeNull();
    clearLiveStatus("p_clear");
    expect(getLiveStatus("p_clear")).toBeNull();
  });

  it("BUG #9 REPRO: snapshot null → caller sabe que debe mostrar '—', NO '?'", () => {
    // El cache retorna null si no hay datos. Los callers (endpoint,
    // page, emitter) usan `snap?.label ?? null` y pasan null a la UI.
    // La UI (LiveHero vía renderMinutoLabel) lo renderiza como "—".
    expect(getLiveStatus("nunca_escrito")).toBeNull();
  });
});
