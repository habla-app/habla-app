// Tests del CountdownLabel — Hotfix #6 Ítem 5.
//
// Los vitest corre en runtime node (sin jsdom), así que los tests de
// render van por AST. El helper `formatCountdown` sí es puro — lo
// testeamos directo.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatCountdown } from "@/lib/utils/datetime";

const ROOT = path.resolve(__dirname, "..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("formatCountdown (reutilizado por CountdownLabel)", () => {
  it("faltan 14 min → 'Cierra en 14 min'", () => {
    const now = new Date("2026-04-19T10:00:00Z");
    const cierre = new Date(now.getTime() + 14 * 60 * 1000);
    const realDate = Date.now;
    try {
      Date.now = () => now.getTime();
      expect(formatCountdown(cierre)).toBe("Cierra en 14 min");
    } finally {
      Date.now = realDate;
    }
  });

  it("faltan 2h 15m → 'Cierra en 2h 15m'", () => {
    const now = new Date("2026-04-19T10:00:00Z");
    const cierre = new Date(now.getTime() + (2 * 60 + 15) * 60 * 1000);
    const realDate = Date.now;
    try {
      Date.now = () => now.getTime();
      expect(formatCountdown(cierre)).toBe("Cierra en 2h 15m");
    } finally {
      Date.now = realDate;
    }
  });

  it("cierre pasado → 'Cerrado'", () => {
    const now = new Date("2026-04-19T10:00:00Z");
    const cierre = new Date(now.getTime() - 60 * 1000);
    const realDate = Date.now;
    try {
      Date.now = () => now.getTime();
      expect(formatCountdown(cierre)).toBe("Cerrado");
    } finally {
      Date.now = realDate;
    }
  });
});

describe("CountdownLabel.tsx — AST antidrift", () => {
  const SRC = readSrc("components/matches/CountdownLabel.tsx");

  it('declara "use client"', () => {
    expect(SRC).toMatch(/^\s*["']use client["']/);
  });

  it("importa formatCountdown del helper oficial", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*formatCountdown\s*\}\s*from\s*["']@\/lib\/utils\/datetime["']/,
    );
  });

  it("usa useEffect + setInterval + clearInterval", () => {
    expect(SRC).toMatch(/useEffect/);
    expect(SRC).toMatch(/setInterval/);
    expect(SRC).toMatch(/clearInterval/);
  });

  it("intervalo fijado a 1000ms (actualización por segundo)", () => {
    // El helper se llama con callback inline y delay 1000; buscamos el
    // literal 1000 cerca del `setInterval`.
    expect(SRC).toMatch(/setInterval\s*\([\s\S]*?1000\s*\)/);
  });
});

describe("MatchCard.tsx — consume CountdownLabel", () => {
  const SRC = readSrc("components/matches/MatchCard.tsx");

  it("importa CountdownLabel", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*CountdownLabel\s*\}\s*from\s*["']\.\/CountdownLabel["']/,
    );
  });

  it("renderea <CountdownLabel cierreAt=...>", () => {
    expect(SRC).toMatch(/<CountdownLabel\s+cierreAt=/);
  });

  it("ya NO llama a formatCountdown directo en server render", () => {
    // el import y el uso previos deben haberse limpiado.
    expect(SRC).not.toMatch(/formatCountdown\s*\(/);
  });
});
