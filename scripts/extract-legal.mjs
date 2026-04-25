// Extrae los 7 documentos legales desde docs/legal-source/contenido-legal.md
// hacia apps/web/content/legal/*.md.
//
// Cada bloque está delimitado por marcadores ====BEGIN:<archivo>==== y
// ====END:<archivo>==== y envuelve contenido markdown dentro de un fence
// ```markdown ... ```. Removemos los marcadores y el fence externo, dejando
// solo el contenido markdown puro.
//
// Los placeholders {{LEGAL_*}} (RAZON_SOCIAL, RUC, PARTIDA_REGISTRAL,
// DOMICILIO_FISCAL, DISTRITO, TITULAR_NOMBRE, TITULAR_DNI) se DEJAN como
// literales en disco. El reemplazo en runtime se hace al renderizar la
// página (lee de env vars; si falta, queda el {{...}} visible para
// señalar dato pendiente).
//
// Los placeholders cosméticos (EMAIL_*, URL_PLATAFORMA, FECHA_VIGENCIA,
// CIUDAD_JURISDICCION) ya están hardcoded en el archivo fuente —
// auditado con grep. No requieren reemplazo.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "docs/legal-source/contenido-legal.md");
const DEST = join(ROOT, "apps/web/content/legal");

const raw = readFileSync(SRC, "utf-8");

// Regex: =BEGIN:foo.md=  ... =END:foo.md=
// Captura el nombre y el contenido entre marcadores.
const blockRe = /====BEGIN:([^=]+?)====\s*([\s\S]*?)\s*====END:\1====/g;

if (!existsSync(DEST)) mkdirSync(DEST, { recursive: true });

let count = 0;
for (const match of raw.matchAll(blockRe)) {
  const filename = match[1].trim();
  let body = match[2];

  // Remover el fence externo ```markdown ... ```
  // El fence puede tener whitespace alrededor.
  body = body.replace(/^\s*```markdown\s*\n/, "");
  body = body.replace(/\n```\s*$/, "");
  body = body.trim() + "\n";

  const out = join(DEST, filename);
  writeFileSync(out, body, "utf-8");
  count++;
  console.log(`  wrote ${out} (${body.length} chars)`);
}

console.log(`\nExtracted ${count} files.`);
if (count !== 7) {
  console.error(`ERROR: expected 7 files, got ${count}`);
  process.exit(1);
}
