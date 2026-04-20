// Tests del Hotfix #9 — seed idempotente de premios y endpoint admin.
//
// Problema reportado en prod (21 Abr): `/tienda` en Railway mostraba
// "No hay premios en esta categoría" porque el seed de
// `packages/db/prisma/seed.ts` nunca corrió contra la BD de producción.
//
// Fix:
//   1. Catálogo compartido en `packages/db/src/catalog.ts` (fuente de verdad
//      única, consumida por seed.ts local + servicio de apps/web).
//   2. `sembrarCatalogoPremios()` en `lib/services/premios-seed.service.ts`
//      con upsert idempotente por nombre (findFirst + update/create).
//   3. `POST /api/v1/admin/seed/premios` y `GET .../status` como endpoints
//      admin para ejecutar el seed en producción sin shell access.
//
// Estos tests son AST-level (no tocan BD) porque vitest corre en node sin
// jsdom y sin Postgres live. La idempotencia se prueba estáticamente: el
// service usa findFirst + update|create en vez de deleteMany + create.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CATALOGO_PREMIOS,
  type CatalogoPremio,
} from "@habla/db";

const ROOT = resolve(__dirname, "..");
const WEB_ROOT = ROOT;
const REPO_ROOT = resolve(ROOT, "..", "..");

const SERVICE_SRC = readFileSync(
  resolve(WEB_ROOT, "lib/services/premios-seed.service.ts"),
  "utf-8",
);
const POST_SRC = readFileSync(
  resolve(WEB_ROOT, "app/api/v1/admin/seed/premios/route.ts"),
  "utf-8",
);
const STATUS_SRC = readFileSync(
  resolve(WEB_ROOT, "app/api/v1/admin/seed/premios/status/route.ts"),
  "utf-8",
);
const SEED_LOCAL_SRC = readFileSync(
  resolve(REPO_ROOT, "packages/db/prisma/seed.ts"),
  "utf-8",
);
const CATALOG_SRC = readFileSync(
  resolve(REPO_ROOT, "packages/db/src/catalog.ts"),
  "utf-8",
);
const ADMIN_PANEL_SRC = readFileSync(
  resolve(WEB_ROOT, "components/admin/AdminSeedPremiosPanel.tsx"),
  "utf-8",
);
const ADMIN_PAGE_SRC = readFileSync(
  resolve(WEB_ROOT, "app/admin/page.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Catálogo compartido — fuente de verdad
// ---------------------------------------------------------------------------

describe("CATALOGO_PREMIOS — constante compartida en @habla/db", () => {
  it("exporta exactamente 25 premios (meta del Sub-Sprint 6)", () => {
    expect(CATALOGO_PREMIOS).toHaveLength(25);
  });

  it("cubre las 5 categorías del §10.6", () => {
    const categorias = new Set(CATALOGO_PREMIOS.map((p) => p.categoria));
    expect(categorias).toEqual(
      new Set(["ENTRADA", "CAMISETA", "GIFT", "TECH", "EXPERIENCIA"]),
    );
  });

  it("tiene UN solo featured (el hero del /tienda)", () => {
    const featured = CATALOGO_PREMIOS.filter((p) => p.featured === true);
    expect(featured).toHaveLength(1);
    expect(featured[0]!.nombre).toBe("Entrada doble al Monumental");
  });

  it("usa los 3 badges (POPULAR, NUEVO, LIMITADO)", () => {
    const badges = new Set(
      CATALOGO_PREMIOS.map((p) => p.badge).filter(Boolean) as string[],
    );
    expect(badges).toEqual(new Set(["POPULAR", "NUEVO", "LIMITADO"]));
  });

  it("marca requiereDireccion en al menos 8 premios físicos (camisetas + tech)", () => {
    const fisicos = CATALOGO_PREMIOS.filter(
      (p: CatalogoPremio) => p.requiereDireccion === true,
    );
    expect(fisicos.length).toBeGreaterThanOrEqual(8);
  });

  it("nombres únicos (para que upsert-by-name sea idempotente)", () => {
    const nombres = CATALOGO_PREMIOS.map((p) => p.nombre);
    const unicos = new Set(nombres);
    expect(unicos.size).toBe(nombres.length);
  });

  it("valorSoles siempre menor que costeLukas (margen positivo)", () => {
    for (const p of CATALOGO_PREMIOS) {
      expect(p.costeLukas).toBeGreaterThan(p.valorSoles);
    }
  });

  it("archivo `catalog.ts` exporta CatalogoCategoria, CatalogoBadge y CatalogoPremio", () => {
    expect(CATALOG_SRC).toMatch(/export\s+type\s+CatalogoCategoria/);
    expect(CATALOG_SRC).toMatch(/export\s+type\s+CatalogoBadge/);
    expect(CATALOG_SRC).toMatch(/export\s+interface\s+CatalogoPremio/);
  });
});

// ---------------------------------------------------------------------------
// Service — upsert idempotente
// ---------------------------------------------------------------------------

describe("premios-seed.service — upsert idempotente", () => {
  it("importa CATALOGO_PREMIOS de @habla/db (no duplica la constante)", () => {
    expect(SERVICE_SRC).toMatch(
      /import\s+\{[^}]*CATALOGO_PREMIOS[^}]*\}\s+from\s+["']@habla\/db["']/,
    );
  });

  it("NO usa deleteMany (seguro en producción — preserva canjes históricos)", () => {
    expect(SERVICE_SRC).not.toMatch(/deleteMany/);
  });

  it("BUG REPRO: usa findFirst + update|create para ser idempotente", () => {
    // Antes del Hotfix #9, el seed hacía `prisma.canje.deleteMany()` +
    // `prisma.premio.deleteMany()` antes del loop — destrozaba el historial
    // y en prod era una bomba. El pattern idempotente hace findFirst por
    // nombre y actualiza o crea sin tocar nada más.
    expect(SERVICE_SRC).toMatch(/findFirst\s*\(\s*\{/);
    expect(SERVICE_SRC).toMatch(/prisma\.premio\.update/);
    expect(SERVICE_SRC).toMatch(/prisma\.premio\.create/);
  });

  it("exporta sembrarCatalogoPremios y obtenerStatusCatalogo", () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+sembrarCatalogoPremios/,
    );
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+obtenerStatusCatalogo/,
    );
  });

  it("devuelve contadores estructurados {creados, actualizados, totalCatalogo, totalEnBD}", () => {
    expect(SERVICE_SRC).toMatch(/creados/);
    expect(SERVICE_SRC).toMatch(/actualizados/);
    expect(SERVICE_SRC).toMatch(/totalCatalogo/);
    expect(SERVICE_SRC).toMatch(/totalEnBD/);
  });

  it("loguea con pino (logger.info) — nunca console.log", () => {
    expect(SERVICE_SRC).toMatch(/logger\.info/);
    expect(SERVICE_SRC).not.toMatch(/console\.log/);
  });

  it("obtenerStatusCatalogo usa groupBy por categoría", () => {
    expect(SERVICE_SRC).toMatch(/groupBy/);
    expect(SERVICE_SRC).toMatch(/porCategoria/);
  });
});

// ---------------------------------------------------------------------------
// Endpoint POST — protegido por ADMIN
// ---------------------------------------------------------------------------

describe("POST /api/v1/admin/seed/premios — auth ADMIN obligatorio", () => {
  it("requiere sesión con NoAutenticado si no hay user.id", () => {
    expect(POST_SRC).toMatch(/NoAutenticado/);
    expect(POST_SRC).toMatch(/!session\?\.user\?\.id/);
  });

  it("requiere rol ADMIN con NoAutorizado si no lo tiene", () => {
    expect(POST_SRC).toMatch(/NoAutorizado/);
    expect(POST_SRC).toMatch(/session\.user\.rol\s*!==\s*["']ADMIN["']/);
  });

  it("delega a sembrarCatalogoPremios del service", () => {
    expect(POST_SRC).toMatch(
      /import\s+\{\s*sembrarCatalogoPremios\s*\}\s+from\s+["']@\/lib\/services\/premios-seed\.service["']/,
    );
    expect(POST_SRC).toMatch(/await\s+sembrarCatalogoPremios\s*\(/);
  });

  it("exporta dynamic = 'force-dynamic' (no cachea resultados entre requests)", () => {
    expect(POST_SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });

  it("usa toErrorResponse + logger.error para errores", () => {
    expect(POST_SRC).toMatch(/toErrorResponse/);
    expect(POST_SRC).toMatch(/logger\.error/);
  });
});

// ---------------------------------------------------------------------------
// Endpoint GET status — protegido por ADMIN
// ---------------------------------------------------------------------------

describe("GET /api/v1/admin/seed/premios/status — auth ADMIN obligatorio", () => {
  it("requiere sesión + rol ADMIN", () => {
    expect(STATUS_SRC).toMatch(/NoAutenticado/);
    expect(STATUS_SRC).toMatch(/NoAutorizado/);
    expect(STATUS_SRC).toMatch(/session\.user\.rol\s*!==\s*["']ADMIN["']/);
  });

  it("delega a obtenerStatusCatalogo del service", () => {
    expect(STATUS_SRC).toMatch(
      /import\s+\{\s*obtenerStatusCatalogo\s*\}\s+from\s+["']@\/lib\/services\/premios-seed\.service["']/,
    );
    expect(STATUS_SRC).toMatch(/await\s+obtenerStatusCatalogo\s*\(/);
  });

  it("exporta dynamic = 'force-dynamic'", () => {
    expect(STATUS_SRC).toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Seed legacy — refactor idempotente
// ---------------------------------------------------------------------------

describe("seed legacy packages/db/prisma/seed.ts — refactor Hotfix #9", () => {
  it("importa CATALOGO_PREMIOS del módulo compartido", () => {
    expect(SEED_LOCAL_SRC).toMatch(
      /from\s+["']\.\.\/src\/catalog["']/,
    );
    expect(SEED_LOCAL_SRC).toMatch(/CATALOGO_PREMIOS/);
  });

  it("BUG REPRO: ya NO contiene `deleteMany` sobre canjes ni premios", () => {
    // El seed pre-Hotfix #9 tenía:
    //   await prisma.canje.deleteMany({});
    //   await prisma.premio.deleteMany({});
    // Comentario en el código decía "en producción esto NO debe correr",
    // pero el script era un tiro de pie potencial si alguien lo disparaba
    // por error. El refactor idempotente los eliminó.
    expect(SEED_LOCAL_SRC).not.toMatch(/prisma\.canje\.deleteMany/);
    expect(SEED_LOCAL_SRC).not.toMatch(/prisma\.premio\.deleteMany/);
  });

  it("usa findFirst + update|create (idempotente, preserva historial)", () => {
    expect(SEED_LOCAL_SRC).toMatch(/findFirst/);
    expect(SEED_LOCAL_SRC).toMatch(/prisma\.premio\.update/);
    expect(SEED_LOCAL_SRC).toMatch(/prisma\.premio\.create/);
  });

  it("sigue creando/upserteando admin", () => {
    expect(SEED_LOCAL_SRC).toMatch(/prisma\.usuario\.upsert/);
    expect(SEED_LOCAL_SRC).toMatch(/admin@habla\.pe/);
  });
});

// ---------------------------------------------------------------------------
// Admin panel UI — integra el seed en /admin
// ---------------------------------------------------------------------------

describe("AdminSeedPremiosPanel — UI para disparar el seed", () => {
  it("es client component ('use client')", () => {
    expect(ADMIN_PANEL_SRC).toMatch(/^["']use client["']/m);
  });

  it("usa authedFetch (§14 convención) contra POST /seed/premios y GET status", () => {
    expect(ADMIN_PANEL_SRC).toMatch(/authedFetch/);
    expect(ADMIN_PANEL_SRC).toMatch(
      /["`']\/api\/v1\/admin\/seed\/premios["`']/,
    );
    expect(ADMIN_PANEL_SRC).toMatch(
      /["`']\/api\/v1\/admin\/seed\/premios\/status["`']/,
    );
    expect(ADMIN_PANEL_SRC).toMatch(/method:\s*["']POST["']/);
  });

  it("NO hace fetch directo contra /api/v1/* (respeta convención §14)", () => {
    expect(ADMIN_PANEL_SRC).not.toMatch(
      /(?<![a-zA-Z])fetch\(["'`]\/api\/v1/,
    );
  });

  it("está montado en /admin/page.tsx", () => {
    expect(ADMIN_PAGE_SRC).toMatch(
      /import\s+\{\s*AdminSeedPremiosPanel\s*\}\s+from/,
    );
    expect(ADMIN_PAGE_SRC).toMatch(/<AdminSeedPremiosPanel\s*\/?>/);
  });

  it("muestra badge visible cuando faltaSembrar=true", () => {
    expect(ADMIN_PANEL_SRC).toMatch(/faltaSembrar/);
  });

  it("muestra contadores creados/actualizados tras el seed exitoso", () => {
    expect(ADMIN_PANEL_SRC).toMatch(/creados/);
    expect(ADMIN_PANEL_SRC).toMatch(/actualizados/);
  });
});
