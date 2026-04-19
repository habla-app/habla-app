// Tests del helper `nivel` — cobertura de los 4 niveles y los bordes.
//
//   0-10     🥉 Novato
//   11-50    🥈 Intermedio
//   51-200   🥇 Pro
//   200+     👑 Leyenda

import { describe, expect, it } from "vitest";
import {
  calcularNivel,
  faltanParaSiguiente,
  siguienteNivel,
} from "@/lib/utils/nivel";

describe("calcularNivel", () => {
  it("0 torneos → Novato", () => {
    expect(calcularNivel(0).key).toBe("novato");
  });

  it("10 torneos → Novato (borde alto inclusivo)", () => {
    expect(calcularNivel(10).key).toBe("novato");
  });

  it("11 torneos → Intermedio (salto al siguiente nivel)", () => {
    expect(calcularNivel(11).key).toBe("intermedio");
  });

  it("50 torneos → Intermedio", () => {
    expect(calcularNivel(50).key).toBe("intermedio");
  });

  it("51 torneos → Pro", () => {
    expect(calcularNivel(51).key).toBe("pro");
  });

  it("200 torneos → Pro (borde alto)", () => {
    expect(calcularNivel(200).key).toBe("pro");
  });

  it("201 torneos → Leyenda", () => {
    expect(calcularNivel(201).key).toBe("leyenda");
  });

  it("9999 torneos → Leyenda (sin techo)", () => {
    expect(calcularNivel(9999).key).toBe("leyenda");
  });

  it("valor negativo se normaliza a 0", () => {
    expect(calcularNivel(-5).key).toBe("novato");
  });

  it("no entero se normaliza con floor", () => {
    expect(calcularNivel(10.9).key).toBe("novato");
    expect(calcularNivel(11.1).key).toBe("intermedio");
  });

  it("emoji del nivel usa los pictogramas del brief (🥉🥈🥇👑)", () => {
    expect(calcularNivel(0).emoji).toBe("🥉");
    expect(calcularNivel(20).emoji).toBe("🥈");
    expect(calcularNivel(100).emoji).toBe("🥇");
    expect(calcularNivel(300).emoji).toBe("👑");
  });
});

describe("siguienteNivel", () => {
  it("desde Novato apunta a Intermedio", () => {
    expect(siguienteNivel(calcularNivel(0))!.key).toBe("intermedio");
  });

  it("desde Intermedio apunta a Pro", () => {
    expect(siguienteNivel(calcularNivel(20))!.key).toBe("pro");
  });

  it("desde Pro apunta a Leyenda", () => {
    expect(siguienteNivel(calcularNivel(100))!.key).toBe("leyenda");
  });

  it("desde Leyenda devuelve null (no hay siguiente)", () => {
    expect(siguienteNivel(calcularNivel(300))).toBeNull();
  });
});

describe("faltanParaSiguiente", () => {
  it("desde 0 faltan 11 para Intermedio", () => {
    expect(faltanParaSiguiente(0)).toBe(11);
  });

  it("desde 24 faltan 27 para Pro", () => {
    expect(faltanParaSiguiente(24)).toBe(27);
  });

  it("desde 199 faltan 2 para Leyenda", () => {
    expect(faltanParaSiguiente(199)).toBe(2);
  });

  it("desde 201 (Leyenda) faltan 0", () => {
    expect(faltanParaSiguiente(201)).toBe(0);
  });
});
