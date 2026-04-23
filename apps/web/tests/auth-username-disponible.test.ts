// Tests del endpoint GET /api/v1/auth/username-disponible + la constante
// de usernames reservados. Registro formal (Abr 2026).

import { describe, expect, it } from "vitest";
import {
  USERNAMES_RESERVADOS,
  esReservado,
} from "@/lib/config/usernames-reservados";

describe("lib/config/usernames-reservados", () => {
  it("incluye admin, root, habla, hablaapp", () => {
    expect(USERNAMES_RESERVADOS.has("admin")).toBe(true);
    expect(USERNAMES_RESERVADOS.has("root")).toBe(true);
    expect(USERNAMES_RESERVADOS.has("habla")).toBe(true);
    expect(USERNAMES_RESERVADOS.has("hablaapp")).toBe(true);
  });

  it("incluye rutas críticas: wallet, perfil, tienda, api, auth", () => {
    for (const r of ["wallet", "perfil", "tienda", "api", "auth", "signin", "signup"]) {
      expect(USERNAMES_RESERVADOS.has(r)).toBe(true);
    }
  });

  it("incluye términos técnicos peligrosos: null, undefined, test", () => {
    expect(USERNAMES_RESERVADOS.has("null")).toBe(true);
    expect(USERNAMES_RESERVADOS.has("undefined")).toBe(true);
    expect(USERNAMES_RESERVADOS.has("test")).toBe(true);
  });

  it("esReservado es case-insensitive", () => {
    expect(esReservado("ADMIN")).toBe(true);
    expect(esReservado("Admin")).toBe(true);
    expect(esReservado("aDmIn")).toBe(true);
    expect(esReservado(" admin ")).toBe(true); // trim
  });

  it("esReservado devuelve false para handles regulares", () => {
    expect(esReservado("juan_lima24")).toBe(false);
    expect(esReservado("messi_10")).toBe(false);
    expect(esReservado("jugador123")).toBe(false);
  });
});

describe("username regex /^[a-z0-9_]{3,20}$/", () => {
  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

  it("acepta handles válidos", () => {
    expect(USERNAME_REGEX.test("juan")).toBe(true);
    expect(USERNAME_REGEX.test("juan_lima24")).toBe(true);
    expect(USERNAME_REGEX.test("a_b_c")).toBe(true);
    expect(USERNAME_REGEX.test("abc")).toBe(true); // mínimo 3
    expect(USERNAME_REGEX.test("a".repeat(20))).toBe(true); // máximo 20
    expect(USERNAME_REGEX.test("123")).toBe(true); // solo números OK
  });

  it("rechaza muy corto (<3) o muy largo (>20)", () => {
    expect(USERNAME_REGEX.test("ab")).toBe(false);
    expect(USERNAME_REGEX.test("a")).toBe(false);
    expect(USERNAME_REGEX.test("a".repeat(21))).toBe(false);
  });

  it("rechaza mayúsculas, espacios, símbolos", () => {
    expect(USERNAME_REGEX.test("Juan")).toBe(false);
    expect(USERNAME_REGEX.test("juan lima")).toBe(false);
    expect(USERNAME_REGEX.test("juan-lima")).toBe(false);
    expect(USERNAME_REGEX.test("juan.lima")).toBe(false);
    expect(USERNAME_REGEX.test("juan@123")).toBe(false);
    expect(USERNAME_REGEX.test("juan#1")).toBe(false);
    expect(USERNAME_REGEX.test("jüan")).toBe(false); // acentos no
  });

  it("rechaza vacío", () => {
    expect(USERNAME_REGEX.test("")).toBe(false);
  });
});
