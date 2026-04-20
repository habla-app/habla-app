// Tests de templates de email. Sub-Sprint 6.
// Unit tests sobre los helpers puros que generan {subject, html, text}.

import { describe, expect, it } from "vitest";
import {
  canjeEnviadoTemplate,
  canjeEntregadoTemplate,
  canjeSolicitadoTemplate,
  datosDescargadosTemplate,
  premioGanadoTemplate,
  solicitudEliminarTemplate,
  torneoCanceladoTemplate,
  verifCodigoSmsEmailTemplate,
} from "../lib/emails/templates";

describe("templates — premio ganado", () => {
  it("1er puesto muestra 🥇", () => {
    const t = premioGanadoTemplate({
      nombreGanador: "Juan",
      torneoNombre: "Copa Lima",
      posicion: 1,
      premioLukas: 100,
      partido: "Alianza vs Universitario",
    });
    expect(t.subject).toContain("🥇");
    expect(t.html).toContain("100");
    expect(t.html).toContain("Juan");
    expect(t.text).toContain("Alianza vs Universitario");
  });

  it("puesto 4 muestra 🏆 genérico", () => {
    const t = premioGanadoTemplate({
      nombreGanador: "X",
      torneoNombre: "Y",
      posicion: 4,
      premioLukas: 10,
      partido: "A vs B",
    });
    expect(t.subject).toContain("🏆");
  });

  it("escapa HTML en nombre del usuario", () => {
    const t = premioGanadoTemplate({
      nombreGanador: "<script>x</script>",
      torneoNombre: "Y",
      posicion: 1,
      premioLukas: 10,
      partido: "A vs B",
    });
    expect(t.html).not.toContain("<script>");
    expect(t.html).toContain("&lt;script&gt;");
  });
});

describe("templates — canje solicitado", () => {
  it("copy diferente para premios con/sin dirección", () => {
    const conDir = canjeSolicitadoTemplate({
      nombreUsuario: "U",
      nombrePremio: "P",
      lukasUsados: 50,
      requiereDireccion: true,
    });
    const sinDir = canjeSolicitadoTemplate({
      nombreUsuario: "U",
      nombrePremio: "P",
      lukasUsados: 50,
      requiereDireccion: false,
    });
    expect(conDir.html).toContain("24 horas");
    expect(sinDir.html).toContain("48 horas");
  });
});

describe("templates — torneo cancelado", () => {
  it("muestra reembolso destacado", () => {
    const t = torneoCanceladoTemplate({
      nombreUsuario: "U",
      torneoNombre: "T",
      partido: "A vs B",
      entradaReembolsada: 5,
    });
    expect(t.subject).toContain("5 Lukas");
    expect(t.html).toContain("+5");
  });
});

describe("templates — solicitud eliminar", () => {
  it("muestra advertencia si balanceLukas > 0", () => {
    const t = solicitudEliminarTemplate({
      nombreUsuario: "U",
      tokenUrl: "https://x.com/t/1",
      balanceLukas: 150,
    });
    expect(t.html).toContain("150");
    expect(t.html).toContain("Perderás");
  });

  it("no muestra advertencia si balance = 0", () => {
    const t = solicitudEliminarTemplate({
      nombreUsuario: "U",
      tokenUrl: "https://x.com/t/1",
      balanceLukas: 0,
    });
    expect(t.html).not.toContain("Perderás");
  });

  it("incluye el token URL clicable + fallback en texto", () => {
    const t = solicitudEliminarTemplate({
      nombreUsuario: "U",
      tokenUrl: "https://example.com/confirm?token=abc",
      balanceLukas: 0,
    });
    expect(t.html).toContain("https://example.com/confirm?token=abc");
    expect(t.text).toContain("https://example.com/confirm?token=abc");
  });
});

describe("templates — verificación SMS fallback email", () => {
  it("muestra código prominente de 6 dígitos", () => {
    const t = verifCodigoSmsEmailTemplate({
      nombreUsuario: "U",
      codigo: "123456",
      expiraEnMin: 10,
    });
    expect(t.html).toContain("123456");
    expect(t.subject).toContain("123456");
  });
});

describe("templates — canje enviado y entregado", () => {
  it("enviado incluye método y tracking opcional", () => {
    const t = canjeEnviadoTemplate({
      nombreUsuario: "U",
      nombrePremio: "P",
      metodo: "Courier Olva",
      codigoSeguimiento: "ABC123",
    });
    expect(t.html).toContain("Courier Olva");
    expect(t.html).toContain("ABC123");
  });

  it("entregado copy corto + CTA volver a jugar", () => {
    const t = canjeEntregadoTemplate({ nombreUsuario: "U", nombrePremio: "P" });
    expect(t.html).toContain("Entregado");
    expect(t.html).toContain("/matches");
  });
});

describe("templates — datos descargados", () => {
  it("incluye url de descarga + TTL en horas", () => {
    const t = datosDescargadosTemplate({
      nombreUsuario: "U",
      urlDescarga: "https://example.com/datos.json",
      expiraEnHoras: 24,
    });
    expect(t.html).toContain("https://example.com/datos.json");
    expect(t.html).toContain("24 horas");
  });
});
