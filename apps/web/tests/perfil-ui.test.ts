// Tests AST de la UI de /perfil. Sub-Sprint 7 + rediseño mockup v1 +
// registro formal (Abr 2026).
//
// La página fue reconstruida desde cero; los componentes ahora viven bajo
// `components/perfil/*` con nombres explícitos (VerificacionSection,
// DatosSection, NotificacionesSection, JuegoResponsableSection,
// FooterSections). Los tests valídan el mismo CONTRATO de features; los
// nombres de archivo se actualizaron con el rediseño.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function read(p: string): string {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

describe("/perfil — page.tsx (RSC)", () => {
  const SRC = read("app/(main)/perfil/page.tsx");

  it("exporta force-dynamic (Hotfix #2 Bug #3)", () => {
    expect(SRC).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("redirige a /auth/signin si no hay sesión", () => {
    expect(SRC).toMatch(/redirect\(["']\/auth\/signin/);
  });

  it("integra los paneles principales del §10.8 + rediseño", () => {
    expect(SRC).toMatch(/ProfileHero/);
    expect(SRC).toMatch(/StatsGrid/);
    expect(SRC).toMatch(/VerificacionSection/);
    expect(SRC).toMatch(/DatosSection/);
    expect(SRC).toMatch(/NotificacionesSection/);
    expect(SRC).toMatch(/JuegoResponsableSection/);
    expect(SRC).toMatch(/FooterSections/);
  });

  it("obtiene perfil, preferencias y límites en paralelo", () => {
    expect(SRC).toMatch(/Promise\.all/);
    expect(SRC).toMatch(/obtenerMiPerfil/);
    expect(SRC).toMatch(/obtenerPreferencias/);
    expect(SRC).toMatch(/obtenerLimites/);
  });
});

describe("/perfil — ProfileHero", () => {
  const SRC = read("components/perfil/ProfileHero.tsx");

  it("muestra nivel.actual.emoji y label", () => {
    expect(SRC).toMatch(/nivel\.actual\.emoji/);
    expect(SRC).toMatch(/nivel\.actual\.label/);
  });

  it("copy 'en N torneos' cuando hay siguiente nivel", () => {
    expect(SRC).toMatch(/faltanParaSiguiente/);
    expect(SRC).toMatch(/nivel\.siguiente/);
  });

  it("muestra @username siempre (registro formal Abr 2026)", () => {
    // username es NOT NULL, así que el hero debe renderizarlo con prefijo @
    expect(SRC).toMatch(/@\{perfil\.username\}/);
  });
});

describe("/perfil — StatsGrid (consumidor del balance via store)", () => {
  const SRC = read("components/perfil/StatsGrid.tsx");

  it("balance con mounted-guard pattern (Hotfix #5)", () => {
    expect(SRC).toMatch(/mounted\s*\?\s*storeBalance\s*:\s*balanceLukas/);
  });

  it("lee useLukasStore con selector s => s.balance", () => {
    expect(SRC).toMatch(/useLukasStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\.balance\s*\)/);
  });
});

describe("/perfil — VerificacionSection (Lote 1: solo email)", () => {
  const SRC = read("components/perfil/VerificacionSection.tsx");

  it("muestra solo rows de email + edad (teléfono/DNI removidos)", () => {
    expect(SRC).toMatch(/title="Correo electrónico"/);
    expect(SRC).toMatch(/title="Edad \(\+18\)"/);
    expect(SRC).not.toMatch(/title="Teléfono"/);
    expect(SRC).not.toMatch(/title="DNI"/);
  });
});

describe("/perfil — DatosSection (username inmutable, Abr 2026)", () => {
  const SRC = read("components/perfil/DatosSection.tsx");

  it("muestra @handle como row read-only (sin botón Editar)", () => {
    expect(SRC).toMatch(/label="Usuario \(@handle\)"/);
    expect(SRC).toMatch(/value=\{`@\$\{perfil\.username\}`\}/);
    expect(SRC).toMatch(/locked/);
    expect(SRC).toMatch(/Tu @handle es permanente/);
  });

  it("PATCH /usuarios/me no intenta enviar username", () => {
    // El username ya no es editable; el type `CampoEditable` debe
    // excluirlo. Asertamos que el union no contiene "username".
    const match = SRC.match(/type\s+CampoEditable\s*=\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain('"username"');
  });
});

describe("/perfil — NotificacionesSection", () => {
  const SRC = read("components/perfil/NotificacionesSection.tsx");

  it("7 toggles completos del §10.8", () => {
    expect(SRC).toMatch(/notifInicioTorneo/);
    expect(SRC).toMatch(/notifResultados/);
    expect(SRC).toMatch(/notifPremios/);
    expect(SRC).toMatch(/notifSugerencias/);
    expect(SRC).toMatch(/notifCierreTorneo/);
    expect(SRC).toMatch(/notifPromos/);
    expect(SRC).toMatch(/emailSemanal/);
  });

  it("debounce de 500ms al togglear", () => {
    expect(SRC).toMatch(/setTimeout\([\s\S]*?500\)/);
  });

  it("usa authedFetch PATCH", () => {
    expect(SRC).toMatch(/authedFetch/);
    expect(SRC).toMatch(/method:\s*["']PATCH["']/);
  });

  it("role=switch + aria-checked para accesibilidad", () => {
    expect(SRC).toMatch(/role="switch"/);
    expect(SRC).toMatch(/aria-checked/);
  });
});

describe("/perfil — JuegoResponsableSection", () => {
  const SRC = read("components/perfil/JuegoResponsableSection.tsx");

  it("muestra barras de uso con colores según %", () => {
    expect(SRC).toMatch(/porcMensual/);
    expect(SRC).toMatch(/porcDiario/);
    expect(SRC).toMatch(/urgent-critical/);
    expect(SRC).toMatch(/urgent-high/);
    expect(SRC).toMatch(/brand-green/);
  });

  it("auto-exclusión acepta solo 7/30/90 días", () => {
    expect(SRC).toMatch(/\[7,\s*30,\s*90\]/);
  });

  it("muestra banner si ya está en auto-exclusión", () => {
    expect(SRC).toMatch(/autoExclusionHasta/);
    expect(SRC).toMatch(/en auto-exclusión hasta/);
  });
});

describe("/perfil — FooterSections (Seguridad / Ayuda / Legal / Danger)", () => {
  const SRC = read("components/perfil/FooterSections.tsx");

  it("flujos: descargar datos + eliminar cuenta con advertencia de saldo", () => {
    expect(SRC).toMatch(/Descargar mis datos/);
    expect(SRC).toMatch(/Eliminar cuenta/);
    expect(SRC).toMatch(/balanceLukas > 0/);
  });

  it("llama endpoints correctos con authedFetch", () => {
    expect(SRC).toMatch(/\/api\/v1\/usuarios\/me\/datos-download/);
    expect(SRC).toMatch(/\/api\/v1\/usuarios\/me\/eliminar/);
    expect(SRC).toMatch(/authedFetch/);
  });

  it("agrupa Seguridad / Ayuda / Legal / Danger zone en 4 SectionShell", () => {
    expect(SRC).toMatch(/title="Seguridad"/);
    expect(SRC).toMatch(/title="Ayuda y soporte"/);
    expect(SRC).toMatch(/title="Información legal"/);
    expect(SRC).toMatch(/Acciones de cuenta/);
    expect(SRC).toMatch(/Cerrar sesión/);
  });
});
