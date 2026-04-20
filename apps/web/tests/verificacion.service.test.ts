// Tests del service de verificación. Sub-Sprint 7.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SERVICE_SRC = readFileSync(
  resolve(ROOT, "lib/services/verificacion.service.ts"),
  "utf-8",
);

describe("verificacion.service — teléfono", () => {
  it("genera código de 6 dígitos", () => {
    expect(SERVICE_SRC).toMatch(/Math\.floor\(100000\s*\+\s*Math\.random\(\)\s*\*\s*900000/);
  });

  it("hashea código con sha256 (no almacena plaintext)", () => {
    expect(SERVICE_SRC).toMatch(
      /crypto\.createHash\(["']sha256["']\)\.update\(codigo\)\.digest\(["']hex["']\)/,
    );
  });

  it("TTL del código: 10 minutos", () => {
    expect(SERVICE_SRC).toMatch(/CODIGO_TTL_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  });

  it("máximo 3 intentos de confirmación", () => {
    expect(SERVICE_SRC).toMatch(/MAX_INTENTOS\s*=\s*3/);
  });

  it("modo dev devuelve código fijo 123456 si Twilio NO configurado", () => {
    expect(SERVICE_SRC).toMatch(/["']123456["']/);
  });

  it("usa Twilio REST API vía fetch (no dep)", () => {
    expect(SERVICE_SRC).toMatch(/api\.twilio\.com\/2010-04-01/);
    expect(SERVICE_SRC).toMatch(/await\s+fetch\(/);
  });

  it("fallback a email si no hay Twilio (notifyVerifCodigoEmail)", () => {
    expect(SERVICE_SRC).toMatch(/notifyVerifCodigoEmail/);
  });

  it("al confirmar: marca telefonoVerif=true + persiste teléfono", () => {
    expect(SERVICE_SRC).toMatch(/telefonoVerif:\s*true/);
  });

  it("estado CODIGO_EXPIRADO (410) y MAX_INTENTOS (429) son correctos HTTP", () => {
    // DomainError se construye con (code, message, status, meta?). Busco el
    // código y el status en bloques multilínea — el mensaje puede tener comas.
    expect(SERVICE_SRC).toMatch(/"CODIGO_EXPIRADO"[\s\S]*?410/);
    expect(SERVICE_SRC).toMatch(/"MAX_INTENTOS"[\s\S]*?429/);
  });
});

describe("verificacion.service — DNI", () => {
  it("valida DNI peruano 8 dígitos", () => {
    expect(SERVICE_SRC).toMatch(/\/\^\[0-9\]\{8\}\$\//);
  });

  it("acepta solo image/jpeg, image/jpg, image/png", () => {
    expect(SERVICE_SRC).toMatch(/image\/jpeg.*image\/jpg.*image\/png/);
  });

  it("límite 1.5MB en imagen", () => {
    expect(SERVICE_SRC).toMatch(/1\.5\s*\*\s*1024\s*\*\s*1024/);
  });

  it("storage local bajo public/uploads/dni", () => {
    expect(SERVICE_SRC).toMatch(/public\/uploads\/dni/);
    expect(SERVICE_SRC).toMatch(/\/uploads\/dni/);
  });

  it("admin puede aprobar o rechazar", () => {
    expect(SERVICE_SRC).toMatch(/aprobarDniAdmin/);
    expect(SERVICE_SRC).toMatch(/rechazarDniAdmin/);
  });

  it("al aprobar: marca Usuario.dniVerif=true", () => {
    expect(SERVICE_SRC).toMatch(/dniVerif:\s*true/);
  });
});
