// Tests del service de usuarios. Sub-Sprint 7 + registro formal (Abr 2026).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/usuarios.service.ts"),
  "utf-8",
);

describe("usuarios.service — obtenerMiPerfil", () => {
  it("incluye nivel.actual, siguiente, faltanParaSiguiente, torneosJugados", () => {
    expect(SERVICE_SRC).toMatch(/calcularNivel/);
    expect(SERVICE_SRC).toMatch(/siguienteNivel/);
    expect(SERVICE_SRC).toMatch(/faltanParaSiguiente/);
  });

  it("cuenta torneos jugados como tickets distintos por torneoId", () => {
    expect(SERVICE_SRC).toMatch(/distinct:\s*\["torneoId"\]/);
  });

  it("skippea usuarios soft-deleted (throw NoAutenticado)", () => {
    expect(SERVICE_SRC).toMatch(/deletedAt/);
    expect(SERVICE_SRC).toMatch(/NoAutenticado/);
  });

  it("expone stats del usuario (calcularStats)", () => {
    expect(SERVICE_SRC).toMatch(/calcularStats/);
  });

  it("proyecta username y usernameLocked en el perfil (registro formal)", () => {
    expect(SERVICE_SRC).toMatch(/username:\s*true/);
    expect(SERVICE_SRC).toMatch(/usernameLocked:\s*true/);
  });
});

describe("usuarios.service — actualizarPerfil (registro formal Abr 2026)", () => {
  it("NO acepta username en el patch (inmutable post-registro)", () => {
    // El ActualizarPerfilInput dropeó el campo username.
    const match = SERVICE_SRC.match(
      /interface\s+ActualizarPerfilInput\s*\{([^}]+)\}/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain("username");
  });

  it("al actualizar teléfono resetea telefonoVerif a false", () => {
    expect(SERVICE_SRC).toMatch(/telefonoVerif:\s*false/);
  });
});

describe("usuarios.service — eliminar cuenta (soft delete)", () => {
  it("solicitarEliminarCuenta genera token random + TTL 48h", () => {
    expect(SERVICE_SRC).toMatch(/crypto\.randomBytes\(32\)/);
    expect(SERVICE_SRC).toMatch(/48\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  it("confirmarEliminarCuenta anonimiza PII: nombre, email, username, telefono, ubicacion, image", () => {
    expect(SERVICE_SRC).toMatch(/nombre:\s*["']Usuario eliminado["']/);
    expect(SERVICE_SRC).toMatch(/deleted-/);
    // Registro formal: username es NOT NULL → asignamos handle anonimizado único.
    expect(SERVICE_SRC).toMatch(/username:\s*anonUsername/);
    expect(SERVICE_SRC).toMatch(/deleted_/);
    expect(SERVICE_SRC).toMatch(/telefono:\s*null/);
    expect(SERVICE_SRC).toMatch(/ubicacion:\s*null/);
    expect(SERVICE_SRC).toMatch(/image:\s*null/);
  });

  it("marca deletedAt al confirmar", () => {
    expect(SERVICE_SRC).toMatch(/deletedAt:\s*new\s+Date\(\)/);
  });

  it("invalida sesiones activas", () => {
    expect(SERVICE_SRC).toMatch(/session\.deleteMany/);
  });

  it("no elimina tickets ni transacciones (integridad audit)", () => {
    expect(SERVICE_SRC).not.toMatch(/ticket\.deleteMany/);
    expect(SERVICE_SRC).not.toMatch(/transaccionLukas\.deleteMany/);
  });

  it("email de confirmación se dispara vía notifySolicitudEliminar", () => {
    expect(SERVICE_SRC).toMatch(/notifySolicitudEliminar/);
  });

  it("valida token expirado (TOKEN_EXPIRADO 410)", () => {
    expect(SERVICE_SRC).toMatch(/"TOKEN_EXPIRADO"/);
    expect(SERVICE_SRC).toMatch(/410/);
  });
});

describe("usuarios.service — export de datos", () => {
  it("exporta perfil + transacciones + tickets + canjes", () => {
    expect(SERVICE_SRC).toMatch(/generarExportDatos/);
    expect(SERVICE_SRC).toMatch(/transaccionLukas\.findMany/);
    expect(SERVICE_SRC).toMatch(/ticket\.findMany/);
    expect(SERVICE_SRC).toMatch(/canje\.findMany/);
  });
});
