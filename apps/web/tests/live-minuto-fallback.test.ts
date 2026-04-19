// Tests del Hotfix #6 Ítem 3:
//   - TTL del cache extendido a 30 min (cubre HT + prórroga).
//   - Hook useRankingEnVivo polea REST como fallback cada 45s.
//   - Endpoint `/api/v1/torneos/:id/ranking` devuelve minutoLabel del cache.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SNAPSHOT_TTL_MS } from "@/lib/services/live-partido-status.cache";

const ROOT = path.resolve(__dirname, "..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("TTL extendido a 30 min (Hotfix #6)", () => {
  it("SNAPSHOT_TTL_MS = 30 * 60 * 1000", () => {
    expect(SNAPSHOT_TTL_MS).toBe(30 * 60 * 1000);
  });
});

describe("useRankingEnVivo — fallback REST cada 45s", () => {
  const SRC = readSrc("hooks/useRankingEnVivo.ts");

  it("define FALLBACK_POLL_MS = 45_000", () => {
    expect(SRC).toMatch(/FALLBACK_POLL_MS\s*=\s*45[_\s]*000/);
  });

  it("usa setInterval con FALLBACK_POLL_MS", () => {
    expect(SRC).toMatch(/setInterval\s*\([\s\S]*?FALLBACK_POLL_MS\s*\)/);
  });

  it("limpia el interval en el cleanup del effect", () => {
    expect(SRC).toMatch(/clearInterval\s*\(\s*pollTimer\s*\)/);
  });

  it("refetch respeta lastUpdateRef para no spamear si el WS sigue alive", () => {
    expect(SRC).toMatch(/lastUpdateRef\.current/);
    expect(SRC).toMatch(/Date\.now\(\)\s*-\s*last\s*<\s*FALLBACK_POLL_MS/);
  });

  it("applySnapshot preserva minutoLabel si el fetch devuelve null (cache stale)", () => {
    expect(SRC).toMatch(
      /minutoLabel:\s*d\.minutoLabel\s*\?\?\s*s\.minutoLabel/,
    );
  });
});

describe("GET /api/v1/torneos/:id/ranking — devuelve minutoLabel del cache", () => {
  const SRC = readSrc("app/api/v1/torneos/[id]/ranking/route.ts");

  it("importa getLiveStatus del cache", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*getLiveStatus\s*\}\s*from\s*["']@\/lib\/services\/live-partido-status\.cache["']/,
    );
  });

  it("incluye minutoLabel + minutoPartido en la respuesta", () => {
    expect(SRC).toMatch(/minutoLabel:\s*liveSnap\?\.label\s*\?\?\s*null/);
    expect(SRC).toMatch(/minutoPartido:\s*liveSnap\?\.minuto\s*\?\?\s*null/);
  });
});
