// Antidrift — prohíbe `session.user.name` en JSX/TSX.
//
// Registro formal (Abr 2026): `session.user.name` ya no se expone en la
// session de NextAuth. Eliminamos el campo del type declaration y toda
// UI debe usar `@username` (del handle único, NOT NULL en BD).
//
// Este test recorre todos los components/app y revienta si encuentra
// un uso literal de `session.user.name` o `user.name` en código TSX.
// Excepciones toleradas:
//   - Comentarios (// o /* */)
//   - Whitelist: tests (patterns) y el archivo types/next-auth.d.ts.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const ROOT = resolve(__dirname, "..");

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry === ".turbo" ||
        entry === "tests"
      ) {
        continue;
      }
      walkTsx(full, acc);
    } else if (
      st.isFile() &&
      (entry.endsWith(".tsx") || entry.endsWith(".ts")) &&
      !entry.endsWith(".d.ts")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

// Patrones prohibidos en código ejecutable.
const PATRONES = [
  /session\.user\.name\b/,
  /usuario\.name\b/,
  /user\.name\b/,
];

// Whitelist — archivos que legítimamente mencionan el viejo campo.
// `lib/auth.ts` ya no usa user.name (adapter lo resuelve solo).
// `auth-adapter.ts` usa el campo `name` del AdapterUser de NextAuth — ése
// es su contrato interno, no el nuestro.
const WHITELIST = new Set<string>([
  "lib/auth-adapter.ts", // AdapterUser.name es contrato de NextAuth
]);

function sinComentarios(src: string): string {
  // Quita comentarios de línea y bloque. Aproximación simple — suficiente
  // para este antidrift (no necesita parser completo).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("antidrift — session.user.name prohibido en JSX/TS", () => {
  const archivos = walkTsx(ROOT);

  for (const full of archivos) {
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    if (WHITELIST.has(rel)) continue;
    it(`${rel} — sin session.user.name / user.name / usuario.name`, () => {
      const raw = readFileSync(full, "utf-8");
      const src = sinComentarios(raw);
      for (const re of PATRONES) {
        if (re.test(src)) {
          throw new Error(
            `${rel}: usa \`${re.source}\`. Migrá a \`session.user.username\` (registro formal Abr 2026).`,
          );
        }
      }
    });
  }
});
