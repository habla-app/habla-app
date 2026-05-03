// AnalisisBasicoCard — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail .analisis-section.
//
// El mockup muestra TRES bloques separados (no uno con texto Markdown):
//   1. 📈 Forma reciente — fila local + fila visita con W/D/L badges
//   2. ⚔️ Cara a cara · últimos 5 — wins local, empates, wins visita,
//      promedio goles
//   3. 🩹 Lesiones y bajas — fila local + fila visita
//
// Como AnalisisPartido.analisisBasico viene del motor como texto largo,
// hacemos best-effort para detectar patrones y renderizar los tres bloques
// del mockup. Si el texto no tiene la estructura esperada, fallback a
// párrafos planos dentro de un único .analisis-section.

interface Props {
  texto: string;
  equipoLocal: string;
  equipoVisita: string;
}

interface FormaResultado {
  letra: "G" | "E" | "P";
}

interface BloquesParseados {
  formaLocal: FormaResultado[] | null;
  formaVisita: FormaResultado[] | null;
  h2hLocalWins: number | null;
  h2hEmpates: number | null;
  h2hVisitaWins: number | null;
  h2hPromedioGoles: number | null;
  lesionesLocal: string | null;
  lesionesVisita: string | null;
  textoCompleto: string;
}

export function AnalisisBasicoCard({ texto, equipoLocal, equipoVisita }: Props) {
  const bloques = parsearAnalisisBasico(texto);
  const tieneAlgunBloque =
    bloques.formaLocal !== null ||
    bloques.h2hLocalWins !== null ||
    bloques.lesionesLocal !== null;

  if (!tieneAlgunBloque) {
    return <FallbackParrafos texto={texto} />;
  }

  return (
    <>
      {bloques.formaLocal && bloques.formaVisita ? (
        <div className="analisis-section">
          <h3>📈 Forma reciente</h3>
          <div className="analisis-row">
            <span className="analisis-row-label">
              {equipoLocal} (local) — últimos 5
            </span>
            <FormaBadges resultados={bloques.formaLocal} />
          </div>
          <div className="analisis-row">
            <span className="analisis-row-label">
              {equipoVisita} (visita) — últimos 5
            </span>
            <FormaBadges resultados={bloques.formaVisita} />
          </div>
        </div>
      ) : null}

      {bloques.h2hLocalWins !== null ? (
        <div className="analisis-section">
          <h3>⚔️ Cara a cara · últimos 5</h3>
          <div className="analisis-row">
            <span className="analisis-row-label">Victorias {equipoLocal}</span>
            <span className="analisis-row-value">{bloques.h2hLocalWins}</span>
          </div>
          <div className="analisis-row">
            <span className="analisis-row-label">Empates</span>
            <span className="analisis-row-value">{bloques.h2hEmpates ?? 0}</span>
          </div>
          <div className="analisis-row">
            <span className="analisis-row-label">Victorias {equipoVisita}</span>
            <span className="analisis-row-value">
              {bloques.h2hVisitaWins ?? 0}
            </span>
          </div>
          {bloques.h2hPromedioGoles !== null ? (
            <div className="analisis-row">
              <span className="analisis-row-label">
                Promedio goles por partido
              </span>
              <span className="analisis-row-value">
                {bloques.h2hPromedioGoles.toFixed(1)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {bloques.lesionesLocal || bloques.lesionesVisita ? (
        <div className="analisis-section">
          <h3>🩹 Lesiones y bajas</h3>
          {bloques.lesionesLocal ? (
            <div className="analisis-row">
              <span className="analisis-row-label">{equipoLocal}</span>
              <span className="analisis-row-value">{bloques.lesionesLocal}</span>
            </div>
          ) : null}
          {bloques.lesionesVisita ? (
            <div className="analisis-row">
              <span className="analisis-row-label">{equipoVisita}</span>
              <span
                className={`analisis-row-value${
                  /3|4|titular/i.test(bloques.lesionesVisita) ? " danger" : ""
                }`}
              >
                {bloques.lesionesVisita}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function FormaBadges({ resultados }: { resultados: FormaResultado[] }) {
  return (
    <div className="forma-badges">
      {resultados.map((r, i) => (
        <span
          key={i}
          className={
            r.letra === "G" ? "forma-w" : r.letra === "E" ? "forma-d" : "forma-l"
          }
        >
          {r.letra}
        </span>
      ))}
    </div>
  );
}

function FallbackParrafos({ texto }: { texto: string }) {
  const parrafos = texto
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="analisis-section">
      <h3>📈 Análisis básico</h3>
      {parrafos.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-body)",
            marginBottom: 10,
          }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parser best-effort. El motor (Lote L) genera el texto con una plantilla
// libre — acá detectamos patrones comunes para reconstruir los bloques del
// mockup. Si no matchea, fallback.
// ---------------------------------------------------------------------------

function parsearAnalisisBasico(texto: string): BloquesParseados {
  const bloques: BloquesParseados = {
    formaLocal: null,
    formaVisita: null,
    h2hLocalWins: null,
    h2hEmpates: null,
    h2hVisitaWins: null,
    h2hPromedioGoles: null,
    lesionesLocal: null,
    lesionesVisita: null,
    textoCompleto: texto,
  };

  // Forma reciente: busca patrones tipo "G G E G G" o "WWLDW"
  const matchFormaLocal = texto.match(
    /(?:forma|últimos\s*5).*local[^\n]*?([GEPWDLgepwdl][\s,-]*){4,5}/i,
  );
  const matchFormaVisita = texto.match(
    /(?:forma|últimos\s*5).*visit[ae][^\n]*?([GEPWDLgepwdl][\s,-]*){4,5}/i,
  );
  if (matchFormaLocal) {
    bloques.formaLocal = parsearForma(matchFormaLocal[0]);
  }
  if (matchFormaVisita) {
    bloques.formaVisita = parsearForma(matchFormaVisita[0]);
  }

  // H2H
  const matchWinsLocal = texto.match(
    /(\d+)\s*victorias?\s+(?:de|del)?\s*local/i,
  );
  const matchEmpates = texto.match(/(\d+)\s*empates?/i);
  const matchWinsVisita = texto.match(
    /(\d+)\s*victorias?\s+(?:de|del)?\s*visit/i,
  );
  const matchPromGoles = texto.match(
    /promedio\s+(?:de\s+)?(?:goles\s+por\s+partido|goles)[^\d]*([\d.]+)/i,
  );
  if (matchWinsLocal) bloques.h2hLocalWins = parseInt(matchWinsLocal[1]);
  if (matchEmpates) bloques.h2hEmpates = parseInt(matchEmpates[1]);
  if (matchWinsVisita) bloques.h2hVisitaWins = parseInt(matchWinsVisita[1]);
  if (matchPromGoles) bloques.h2hPromedioGoles = parseFloat(matchPromGoles[1]);

  // Lesiones (texto libre por equipo)
  const matchLesionesLocal = texto.match(
    /local[^:\n]*:\s*(\d+\s*(?:lesionados?|titulares?|fuera)[^.\n]*)/i,
  );
  const matchLesionesVisita = texto.match(
    /visit[ae][^:\n]*:\s*(\d+\s*(?:lesionados?|titulares?|fuera)[^.\n]*)/i,
  );
  if (matchLesionesLocal) bloques.lesionesLocal = matchLesionesLocal[1].trim();
  if (matchLesionesVisita) bloques.lesionesVisita = matchLesionesVisita[1].trim();

  return bloques;
}

function parsearForma(linea: string): FormaResultado[] {
  const matches = linea.match(/[GEPWDLgepwdl]/g) ?? [];
  return matches.slice(-5).map((c) => ({
    letra: normalizarLetra(c),
  }));
}

function normalizarLetra(c: string): "G" | "E" | "P" {
  const u = c.toUpperCase();
  if (u === "W" || u === "G") return "G";
  if (u === "D" || u === "E") return "E";
  return "P";
}
