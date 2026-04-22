// Tests AST de la UI de /perfil. Sub-Sprint 7.

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

  it("redirige a /auth/login si no hay sesión", () => {
    expect(SRC).toMatch(/redirect\(["']\/auth\/login/);
  });

  it("integra los 6 paneles principales del §10.8", () => {
    expect(SRC).toMatch(/ProfileHero/);
    expect(SRC).toMatch(/StatsGrid/);
    expect(SRC).toMatch(/VerificacionPanel/);
    expect(SRC).toMatch(/DatosPersonalesPanel/);
    expect(SRC).toMatch(/PreferenciasPanel/);
    expect(SRC).toMatch(/LimitesPanel/);
    // Rediseño mockup v1: DatosYPrivacidadPanel se absorbió en
    // ProfileFooterSections, que también trae Seguridad, Ayuda y Legal.
    expect(SRC).toMatch(/ProfileFooterSections/);
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
    // Rediseño mockup v1: el balance ya no está en el hero (pasó a
    // StatsGrid con mounted-guard). El level-card mantiene "Próximo: X
    // en N torneos" usando faltanParaSiguiente.
    expect(SRC).toMatch(/faltanParaSiguiente/);
    expect(SRC).toMatch(/nivel\.siguiente/);
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

describe("/perfil — VerificacionPanel", () => {
  const SRC = read("components/perfil/VerificacionPanel.tsx");

  it("4 rows: email, edad, teléfono, DNI", () => {
    // Rediseño mockup v1: usa prop `title=` en VerifRow en vez de `label=`.
    expect(SRC).toMatch(/title="Correo electrónico"/);
    expect(SRC).toMatch(/title="Edad \(\+18\)"/);
    expect(SRC).toMatch(/title="Teléfono"/);
    expect(SRC).toMatch(/title="DNI"/);
  });

  it("usa authedFetch (§14)", () => {
    expect(SRC).toMatch(/authedFetch/);
    expect(SRC).not.toMatch(/fetch\(["']\/api\/v1\//);
  });

  it("flujo teléfono: 2 pasos (teléfono → código)", () => {
    // El state machine vive en el componente TelefonoModal: `paso === 'telefono'`
    // en la rama del formulario inicial; setPaso("codigo") en la confirmación.
    expect(SRC).toMatch(/paso === ["']telefono["']/);
    expect(SRC).toMatch(/setPaso\(["']codigo["']\)/);
  });

  it("muestra devCode en modo dev", () => {
    expect(SRC).toMatch(/devCode/);
  });

  it("DNI: input file + preview + submit base64", () => {
    expect(SRC).toMatch(/imagenBase64/);
    expect(SRC).toMatch(/FileReader/);
  });
});

describe("/perfil — PreferenciasPanel", () => {
  const SRC = read("components/perfil/PreferenciasPanel.tsx");

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

describe("/perfil — LimitesPanel", () => {
  const SRC = read("components/perfil/LimitesPanel.tsx");

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

describe("/perfil — ProfileFooterSections (absorbió DatosYPrivacidadPanel)", () => {
  const SRC = read("components/perfil/ProfileFooterSections.tsx");

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
    // Danger zone es una sección propia inline (no SectionShell).
    expect(SRC).toMatch(/Acciones de cuenta/);
    expect(SRC).toMatch(/Cerrar sesión/);
  });
});
