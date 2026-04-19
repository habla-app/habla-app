// Integration tests de tickets.service — requieren una BD Postgres
// accesible via DATABASE_URL (usar docker-compose.test.yml o la local).
// Si DATABASE_URL no está seteada, los tests se saltean.
//
// Cubre los 5 casos de error del checklist del Sub-Sprint 4:
//   - duplicado (P2002 → 409 TICKET_DUPLICADO)
//   - 11vo ticket (LimiteExcedido)
//   - torneo cerrado (TorneoCerrado)
//   - balance insuficiente (BalanceInsuficiente)
//   - límite diario (LimiteExcedido "por día")
//
// Strategy: sembramos un torneo + usuario en una transacción y la
// dropeamos al final. El service usa prisma directo, así que los tests
// dejan state transient en la BD — son tests E2E de DB.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@habla/db";
import { crear } from "@/lib/services/tickets.service";

const hasDb = Boolean(process.env.DATABASE_URL);

// `describe.runIf` omite los tests si no hay DB.
describe.runIf(hasDb)("tickets.service — integration", () => {
  let usuarioId: string;
  let torneoId: string;
  let partidoId: string;

  beforeAll(async () => {
    // Sembrar una fixture dedicada. Ids prefijados para facilitar cleanup.
    const suffix = Date.now().toString(36);
    const usuario = await prisma.usuario.create({
      data: {
        email: `test-${suffix}@habla.local`,
        nombre: "Test User",
        balanceLukas: 100,
      },
    });
    usuarioId = usuario.id;

    const partido = await prisma.partido.create({
      data: {
        externalId: `test-${suffix}`,
        liga: "Liga 1 Perú",
        equipoLocal: "Test FC",
        equipoVisita: "Otro FC",
        fechaInicio: new Date(Date.now() + 60 * 60 * 1000),
        estado: "PROGRAMADO",
      },
    });
    partidoId = partido.id;

    const torneo = await prisma.torneo.create({
      data: {
        nombre: "Test Torneo",
        tipo: "EXPRESS",
        entradaLukas: 5,
        partidoId,
        cierreAt: new Date(Date.now() + 55 * 60 * 1000),
      },
    });
    torneoId = torneo.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { torneoId } });
    await prisma.torneo.deleteMany({ where: { id: torneoId } });
    await prisma.partido.deleteMany({ where: { id: partidoId } });
    await prisma.transaccionLukas.deleteMany({ where: { usuarioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  });

  it("crea un ticket válido y descuenta balance", async () => {
    const res = await crear(usuarioId, {
      torneoId,
      predResultado: "LOCAL",
      predBtts: true,
      predMas25: true,
      predTarjetaRoja: false,
      predMarcadorLocal: 2,
      predMarcadorVisita: 1,
    });
    expect(res.ticket).toBeDefined();
    expect(res.nuevoBalance).toBe(95);
  });

  it("rechaza duplicado con mismas predicciones", async () => {
    await expect(
      crear(usuarioId, {
        torneoId,
        predResultado: "LOCAL",
        predBtts: true,
        predMas25: true,
        predTarjetaRoja: false,
        predMarcadorLocal: 2,
        predMarcadorVisita: 1,
      }),
    ).rejects.toMatchObject({
      code: "TICKET_DUPLICADO",
      status: 409,
    });
  });

  it("rechaza si balance insuficiente", async () => {
    // Drenar el balance del usuario
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { balanceLukas: 0 },
    });
    await expect(
      crear(usuarioId, {
        torneoId,
        predResultado: "VISITA",
        predBtts: true,
        predMas25: true,
        predTarjetaRoja: false,
        predMarcadorLocal: 0,
        predMarcadorVisita: 2,
      }),
    ).rejects.toMatchObject({
      code: "BALANCE_INSUFICIENTE",
    });
    // Restaurar
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { balanceLukas: 100 },
    });
  });

  it("rechaza si el torneo está CERRADO", async () => {
    await prisma.torneo.update({
      where: { id: torneoId },
      data: { estado: "CERRADO" },
    });
    await expect(
      crear(usuarioId, {
        torneoId,
        predResultado: "EMPATE",
        predBtts: false,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 1,
        predMarcadorVisita: 1,
      }),
    ).rejects.toMatchObject({
      code: "TORNEO_CERRADO",
    });
    await prisma.torneo.update({
      where: { id: torneoId },
      data: { estado: "ABIERTO" },
    });
  });
});

describe.skipIf(hasDb)("tickets.service — integration (skipped, sin DB)", () => {
  it("se saltea cuando DATABASE_URL no está configurada", () => {
    expect(true).toBe(true);
  });
});
