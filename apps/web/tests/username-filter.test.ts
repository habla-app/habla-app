// Tests del filtro de usernames ofensivos (Abr 2026).
//
// No pretende ser un catálogo exhaustivo — sólo verifica que la lógica
// leet-speak y substring-match funcionen para los casos representativos.

import { describe, expect, it } from "vitest";
import { esUsernameOfensivo } from "@/lib/utils/username-filter";

describe("esUsernameOfensivo", () => {
  it("rechaza términos obvios en español e inglés", () => {
    expect(esUsernameOfensivo("puta")).toBe(true);
    expect(esUsernameOfensivo("PUTA")).toBe(true); // case-insensitive
    expect(esUsernameOfensivo("fuck")).toBe(true);
    expect(esUsernameOfensivo("MIERDA")).toBe(true);
    expect(esUsernameOfensivo("nazi")).toBe(true);
  });

  it("rechaza términos embebidos en otro texto", () => {
    expect(esUsernameOfensivo("xxputa99")).toBe(true);
    expect(esUsernameOfensivo("my_fuck_team")).toBe(true);
  });

  it("rechaza variantes leet-speak básicas", () => {
    expect(esUsernameOfensivo("put4")).toBe(true); // a → 4
    expect(esUsernameOfensivo("sh1t")).toBe(true); // i → 1
    expect(esUsernameOfensivo("h1tler")).toBe(true);
    expect(esUsernameOfensivo("fuk")).toBe(false); // sin leet no cubierto
    expect(esUsernameOfensivo("m13rd4")).toBe(true); // mierda via i→1, e→3
  });

  it("acepta handles normales", () => {
    expect(esUsernameOfensivo("juan_lima")).toBe(false);
    expect(esUsernameOfensivo("Gustavo")).toBe(false);
    expect(esUsernameOfensivo("crack_peruano")).toBe(false);
    expect(esUsernameOfensivo("messi10")).toBe(false);
  });

  it("maneja vacío sin crashear", () => {
    expect(esUsernameOfensivo("")).toBe(false);
  });
});
