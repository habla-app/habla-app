// Tests del cache L1 (in-memory) del estado en vivo. El L2 (BD) se mockea
// porque estos son tests puros — la cobertura del roundtrip a BD vive en
// los tests antidrift de los endpoints que lo consumen.
//
// Invariante clave preservado: snapshot null → caller muestra "—",
// NUNCA "?".

import { beforeEach, describe, expect, it, vi } from "vitest";

// Prisma mock: `setLiveStatus` no explota si la BD no está disponible y
// `getLiveStatus` cae a un L2 "vacío" cuando el L1 expiró.
vi.mock("@habla/db", () => ({
  prisma: {
    partido: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

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

  it("setLiveStatus guarda snapshot con label computado por el mapper", async () => {
    const snap = await setLiveStatus("partido_1", "2H", 67);
    expect(snap.partidoId).toBe("partido_1");
    expect(snap.statusShort).toBe("2H");
    expect(snap.minuto).toBe(67);
    expect(snap.extra).toBe(null);
    expect(snap.label).toBe("67'"); // getMinutoLabel('2H', 67)
  });

  it("setLiveStatus con HT → label 'Medio tiempo'", async () => {
    const snap = await setLiveStatus("partido_2", "HT", null);
    expect(snap.label).toBe("Medio tiempo");
  });

  it("setLiveStatus con FT → label 'Final'", async () => {
    const snap = await setLiveStatus("partido_3", "FT", 90);
    expect(snap.label).toBe("Final");
  });

  it("setLiveStatus con 1H + extra > 0 → label '{minuto}+{extra}''", async () => {
    const snap = await setLiveStatus("partido_extra", "1H", 45, 3);
    expect(snap.extra).toBe(3);
    expect(snap.label).toBe("45+3'");
  });

  it("getLiveStatus devuelve el último snapshot escrito", async () => {
    await setLiveStatus("p1", "1H", 10);
    await setLiveStatus("p1", "1H", 30);
    const snap = await getLiveStatus("p1");
    expect(snap).not.toBeNull();
    expect(snap!.minuto).toBe(30);
    expect(snap!.label).toBe("30'");
  });

  it("getLiveStatus con partidoId no registrado (ni L1 ni L2) → null", async () => {
    expect(await getLiveStatus("no_existe")).toBeNull();
  });

  it("snapshot expira a los SNAPSHOT_TTL_MS (L1 borrado, L2 mockeado vacío)", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-04-19T15:00:00Z");
    vi.setSystemTime(start);
    await setLiveStatus("p_ttl", "2H", 50);
    expect(await getLiveStatus("p_ttl")).not.toBeNull();

    // Avanza el reloj 31 min (> TTL 30 min).
    vi.setSystemTime(new Date(start.getTime() + SNAPSHOT_TTL_MS + 60_000));
    expect(await getLiveStatus("p_ttl")).toBeNull();
  });

  it("clearLiveStatus remueve el snapshot de L1", async () => {
    await setLiveStatus("p_clear", "1H", 20);
    expect(await getLiveStatus("p_clear")).not.toBeNull();
    clearLiveStatus("p_clear");
    // Con L1 limpio cae a L2 mockeado (vacío) → null.
    expect(await getLiveStatus("p_clear")).toBeNull();
  });

  it("snapshot null → caller sabe que debe mostrar '—', NO '?'", async () => {
    // El cache retorna null si no hay datos. Los callers (endpoint,
    // page, emitter) usan `snap?.label ?? null` y pasan null a la UI.
    // La UI (LiveHero vía useMinutoEnVivo) lo renderiza como "—".
    expect(await getLiveStatus("nunca_escrito")).toBeNull();
  });
});
