// Tests unitarios del motor de puntuación — función pura.
// Cubre la matriz de las 5 predicciones según CLAUDE.md §2.
//
// Hotfix #6 — Bug #4: TODOS los campos proyectan en vivo incluyendo
// marcador exacto. Los tests reflejan esa semántica — lo que antes
// estaba "pendiente" durante EN_VIVO ahora ya se adjudica como
// proyección "si terminara ahora".

import { describe, expect, it } from "vitest";
import {
  calcularPuntosTicket,
  PUNTOS_CERO,
  type SnapshotPartido,
} from "@/lib/services/puntuacion.service";

type Ticket = Parameters<typeof calcularPuntosTicket>[0];

const TICKET_BASE: Ticket = {
  predResultado: "LOCAL",
  predBtts: true,
  predMas25: true,
  predTarjetaRoja: false,
  predMarcadorLocal: 2,
  predMarcadorVisita: 1,
};

function snap(partial: Partial<SnapshotPartido>): SnapshotPartido {
  return {
    golesLocal: null,
    golesVisita: null,
    btts: null,
    mas25Goles: null,
    huboTarjetaRoja: null,
    estado: "EN_VIVO",
    ...partial,
  };
}

describe("calcularPuntosTicket", () => {
  describe("partido PROGRAMADO / sin marcador", () => {
    it("sin golesLocal/Visita devuelve todo 0", () => {
      const r = calcularPuntosTicket(TICKET_BASE, snap({ estado: "PROGRAMADO" }));
      expect(r).toEqual(PUNTOS_CERO);
    });
  });

  describe("resultado 1X2 (3 pts, sólo al FINALIZADO)", () => {
    it("acierta LOCAL cuando partido termina 2-1", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({
          golesLocal: 2,
          golesVisita: 1,
          estado: "FINALIZADO",
          btts: true,
          mas25Goles: true,
        }),
      );
      expect(r.resultado).toBe(3);
    });

    it("falla LOCAL cuando partido termina 0-1", () => {
      const t: Ticket = { ...TICKET_BASE };
      const r = calcularPuntosTicket(
        t,
        snap({
          golesLocal: 0,
          golesVisita: 1,
          estado: "FINALIZADO",
        }),
      );
      expect(r.resultado).toBe(0);
    });

    it("acierta EMPATE cuando 1-1 termina", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predResultado: "EMPATE" },
        snap({
          golesLocal: 1,
          golesVisita: 1,
          estado: "FINALIZADO",
        }),
      );
      expect(r.resultado).toBe(3);
    });

    it("durante EN_VIVO adjudica el punto según el marcador actual (proyección live)", () => {
      // El ranking en vivo refleja "¿quién gana si terminara ahora?".
      // Si el marcador es 2-1 y el ticket predijo LOCAL, ya es 3 pts;
      // si luego se empata, se descuenta (el motor es una función pura).
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({
          golesLocal: 2,
          golesVisita: 1,
          estado: "EN_VIVO",
        }),
      );
      expect(r.resultado).toBe(3);
    });

    it("durante EN_VIVO 0-0 con predResultado=LOCAL → no adjudica (ahora es empate)", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predResultado: "LOCAL" },
        snap({
          golesLocal: 0,
          golesVisita: 0,
          estado: "EN_VIVO",
        }),
      );
      expect(r.resultado).toBe(0);
    });
  });

  describe("BTTS (2 pts) — confirmación parcial durante EN_VIVO", () => {
    it("EN_VIVO con goles de ambos → predBtts=true se adjudica", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({ golesLocal: 1, golesVisita: 1, estado: "EN_VIVO" }),
      );
      expect(r.btts).toBe(2);
    });

    it("FINALIZADO 2-0 con predBtts=false → se adjudica", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predBtts: false },
        snap({
          golesLocal: 2,
          golesVisita: 0,
          btts: false,
          estado: "FINALIZADO",
        }),
      );
      expect(r.btts).toBe(2);
    });

    it("EN_VIVO 2-0 con predBtts=false se adjudica como proyección (Hotfix #6)", () => {
      // Antes del Hotfix #6 este test asertaba 0 (pendiente porque el
      // que tiene 0 goles podía anotar). Nueva semántica: proyecta.
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predBtts: false },
        snap({ golesLocal: 2, golesVisita: 0, estado: "EN_VIVO" }),
      );
      expect(r.btts).toBe(2);
    });

    it("EN_VIVO 0-0 con predBtts=false se adjudica como proyección (Hotfix #6)", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predBtts: false },
        snap({ golesLocal: 0, golesVisita: 0, estado: "EN_VIVO" }),
      );
      expect(r.btts).toBe(2);
    });
  });

  describe("más de 2.5 goles (2 pts)", () => {
    it("EN_VIVO con 3 goles → predMas25=true adjudica", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({ golesLocal: 2, golesVisita: 1, estado: "EN_VIVO" }),
      );
      expect(r.mas25).toBe(2);
    });

    it("FINALIZADO 1-1 con predMas25=false adjudica", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predMas25: false },
        snap({ golesLocal: 1, golesVisita: 1, estado: "FINALIZADO" }),
      );
      expect(r.mas25).toBe(2);
    });
  });

  describe("tarjeta roja (6 pts)", () => {
    it("hubo roja → predTarjetaRoja=true adjudica al toque", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predTarjetaRoja: true },
        snap({
          golesLocal: 0,
          golesVisita: 0,
          huboTarjetaRoja: true,
          estado: "EN_VIVO",
        }),
      );
      expect(r.tarjeta).toBe(6);
    });

    it("sin roja durante EN_VIVO → predTarjetaRoja=false adjudica como proyección (Hotfix #6)", () => {
      // Antes del Hotfix #6 quedaba pendiente (0). Ahora proyecta los 6
      // pts como "si terminara ahora, no hay roja".
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predTarjetaRoja: false },
        snap({ golesLocal: 0, golesVisita: 0, estado: "EN_VIVO" }),
      );
      expect(r.tarjeta).toBe(6);
    });

    it("FINALIZADO sin roja → predTarjetaRoja=false adjudica", () => {
      const r = calcularPuntosTicket(
        { ...TICKET_BASE, predTarjetaRoja: false },
        snap({
          golesLocal: 1,
          golesVisita: 0,
          huboTarjetaRoja: false,
          estado: "FINALIZADO",
        }),
      );
      expect(r.tarjeta).toBe(6);
    });
  });

  describe("marcador exacto (8 pts) — Hotfix #6: proyecta en vivo", () => {
    it("acierta 2-1 al finalizar", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({
          golesLocal: 2,
          golesVisita: 1,
          estado: "FINALIZADO",
          btts: true,
          mas25Goles: true,
        }),
      );
      expect(r.marcador).toBe(8);
    });

    it("durante EN_VIVO con 2-1 se adjudica como proyección (Hotfix #6)", () => {
      // Antes del Hotfix #6 devolvía 0 (volatilidad mata el UX del live).
      // Ahora proyecta "si terminara ahora, marcador exacto ✓".
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({ golesLocal: 2, golesVisita: 1, estado: "EN_VIVO" }),
      );
      expect(r.marcador).toBe(8);
    });

    it("EN_VIVO con score que NO coincide → 0", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({ golesLocal: 1, golesVisita: 1, estado: "EN_VIVO" }),
      );
      expect(r.marcador).toBe(0);
    });
  });

  describe("Hotfix #6 Bug #4 — ticket proyectivo puro", () => {
    // Regresión del bug reportado: partido 0-0 minuto 3, sin tarjetas,
    // predicción "Empate / No / No / No / 0-0" → 21 pts (todo acertado
    // como proyección).
    it("0-0 minuto 3 con ticket perfecto proyectado → 21 pts", () => {
      const ticketPerfecto: Ticket = {
        predResultado: "EMPATE",
        predBtts: false,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 0,
        predMarcadorVisita: 0,
      };
      const r = calcularPuntosTicket(
        ticketPerfecto,
        snap({
          golesLocal: 0,
          golesVisita: 0,
          estado: "EN_VIVO",
        }),
      );
      expect(r.resultado).toBe(3);
      expect(r.btts).toBe(2);
      expect(r.mas25).toBe(2);
      expect(r.tarjeta).toBe(6);
      expect(r.marcador).toBe(8);
      expect(r.total).toBe(21);
    });

    it("transición 0-0 → 0-1 revierte marcador exacto pero mantiene proyección del resto", () => {
      const ticket: Ticket = {
        predResultado: "EMPATE",
        predBtts: false,
        predMas25: false,
        predTarjetaRoja: false,
        predMarcadorLocal: 0,
        predMarcadorVisita: 0,
      };
      const antes = calcularPuntosTicket(
        ticket,
        snap({ golesLocal: 0, golesVisita: 0, estado: "EN_VIVO" }),
      );
      const despues = calcularPuntosTicket(
        ticket,
        snap({ golesLocal: 0, golesVisita: 1, estado: "EN_VIVO" }),
      );
      expect(antes.total).toBe(21);
      // Tras 0-1: resultado (Empate) ya no acierta (ahora es VISITA) → 0
      // BTTS "No" sigue proyectando verdadero (goles.home=0) → 2
      // +2.5 "No" sigue true (total=1) → 2
      // Roja "No" true → 6
      // Marcador "0-0" ya no coincide (0-1) → 0
      expect(despues.resultado).toBe(0);
      expect(despues.btts).toBe(2);
      expect(despues.mas25).toBe(2);
      expect(despues.tarjeta).toBe(6);
      expect(despues.marcador).toBe(0);
      expect(despues.total).toBe(10);
    });

    it("roja aparece durante EN_VIVO → predTarjetaRoja=false pierde los 6 pts", () => {
      const ticket: Ticket = {
        ...TICKET_BASE,
        predTarjetaRoja: false,
      };
      const sinRoja = calcularPuntosTicket(
        ticket,
        snap({ golesLocal: 1, golesVisita: 0, estado: "EN_VIVO" }),
      );
      const conRoja = calcularPuntosTicket(
        ticket,
        snap({
          golesLocal: 1,
          golesVisita: 0,
          huboTarjetaRoja: true,
          estado: "EN_VIVO",
        }),
      );
      expect(sinRoja.tarjeta).toBe(6);
      expect(conRoja.tarjeta).toBe(0);
    });
  });

  describe("match perfecto — 21 pts", () => {
    it("ticket 100% al finalizar", () => {
      const r = calcularPuntosTicket(
        TICKET_BASE,
        snap({
          golesLocal: 2,
          golesVisita: 1,
          btts: true,
          mas25Goles: true,
          huboTarjetaRoja: false,
          estado: "FINALIZADO",
        }),
      );
      expect(r.total).toBe(21);
      expect(r.resultado).toBe(3);
      expect(r.btts).toBe(2);
      expect(r.mas25).toBe(2);
      expect(r.tarjeta).toBe(6);
      expect(r.marcador).toBe(8);
    });
  });

  describe("idempotencia", () => {
    it("dos ejecuciones con mismos inputs dan mismo resultado", () => {
      const s = snap({
        golesLocal: 3,
        golesVisita: 2,
        btts: true,
        mas25Goles: true,
        huboTarjetaRoja: true,
        estado: "FINALIZADO",
      });
      const a = calcularPuntosTicket(TICKET_BASE, s);
      const b = calcularPuntosTicket(TICKET_BASE, s);
      expect(a).toEqual(b);
    });
  });
});
