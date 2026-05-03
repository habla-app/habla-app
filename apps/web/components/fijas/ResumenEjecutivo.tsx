// ResumenEjecutivo — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail (.resumen-ejecutivo).
//
// Estructura única (mockup line 2803-2926):
//   .resumen-ejecutivo
//     .resumen-recomend (pronóstico + cuota best)
//     .resumen-prob-grid (3 columnas Local/Empate/Visita con %)
//     .resumen-mejor-cuota (banner mejor cuota Local + Apostar)
//     [Si NO socios] .resumen-pick-socios (cebo blur + CTA)
//     [Si SI socios] .pick-socios-unlocked (combinada óptima desbloqueada)
//
// Free + Visitor ven el bloque "not-socios-only".
// Socios ven el bloque "socios-only".

import { AuthGate } from "@/components/auth/AuthGate";

interface MercadoExtra {
  mercado: string;
  cuota: number;
  casa: string;
  ev?: number | null;
}

interface CombinadaOptima {
  pronostico: string;
  cuotaTotal: number;
  casa: string;
  stake: string;
  evPlus: number;
  confianza?: number | null;
  razonamiento?: string | null;
  mercadosExtra?: MercadoExtra[];
}

interface Props {
  pronostico: "LOCAL" | "EMPATE" | "VISITA";
  probabilidades: { local?: number; empate?: number; visita?: number };
  mejorCuota: { mercado: string; cuota: number; casa: string };
  /** Cuotas 1X2 de las 3 columnas de la grilla de probabilidades. Cada
   *  una puede ser null si el análisis no las trae. La cuota Local NO es
   *  necesariamente la cuota del pronóstico — es la cuota del mercado
   *  Local, que se renderiza en la celda Local sin importar el pronóstico. */
  cuotas1X2?: {
    local: number | null;
    empate: number | null;
    visita: number | null;
  };
  equipoLocal: string;
  equipoVisita: string;
  /** Cebo a mostrar bajo blur cuando NO es socio. */
  ceboCombinada: string;
  /** Datos completos para el bloque desbloqueado (Socios). */
  combinadaOptima: CombinadaOptima | null;
  /** Estado actual del visitor para el CTA del cebo. */
  estadoAuth: "visitor" | "free" | "socios";
}

export function ResumenEjecutivo({
  pronostico,
  probabilidades,
  mejorCuota,
  cuotas1X2,
  equipoLocal,
  equipoVisita,
  ceboCombinada,
  combinadaOptima,
  estadoAuth,
}: Props) {
  const probLocal = Math.round((probabilidades.local ?? 0) * 100);
  const probEmpate = Math.round((probabilidades.empate ?? 0) * 100);
  const probVisita = Math.round((probabilidades.visita ?? 0) * 100);
  const probSeleccionada =
    pronostico === "LOCAL"
      ? probLocal
      : pronostico === "EMPATE"
        ? probEmpate
        : probVisita;
  const labelGana =
    pronostico === "LOCAL"
      ? `Gana ${equipoLocal}`
      : pronostico === "VISITA"
        ? `Gana ${equipoVisita}`
        : "Empate";
  const ctaSocios =
    estadoAuth === "visitor"
      ? "Registrate gratis para desbloquear →"
      : "Hacete Socio para desbloquear →";

  // Cuotas 1X2 con backfill: si cuotas1X2 no llega (análisis viejo sin
  // cuotasReferenciales), usamos mejorCuota para la celda del pronóstico
  // y dejamos las otras dos en null para que se rendericen como "—".
  const mcMercado = mejorCuota.mercado.toUpperCase();
  const cuotaLocal =
    cuotas1X2?.local ?? (mcMercado === "LOCAL" ? mejorCuota.cuota : null);
  const cuotaEmpate =
    cuotas1X2?.empate ?? (mcMercado === "EMPATE" ? mejorCuota.cuota : null);
  const cuotaVisita =
    cuotas1X2?.visita ?? (mcMercado === "VISITA" ? mejorCuota.cuota : null);

  // Estructura común (todo el resumen-ejecutivo). Diferencia: el bloque final
  // cambia según auth. Hacemos render duplicado dentro de AuthGate igual al
  // mockup que tiene .resumen-ejecutivo.not-socios-only y .socios-only.

  return (
    <>
      {/* ===== Resumen ejecutivo · FREE / VISITANTE ===== */}
      <AuthGate state={["visitor", "free"]}>
        <div className="resumen-ejecutivo">
          <RecomendBlock
            label="Pronóstico Habla! · gratis"
            value={`${labelGana} · ${probSeleccionada}% prob`}
            cuota={mejorCuota.cuota}
          />

          <ProbGrid
            pron={pronostico}
            probLocal={probLocal}
            probEmpate={probEmpate}
            probVisita={probVisita}
            cuotaLocal={cuotaLocal}
            cuotaEmpate={cuotaEmpate}
            cuotaVisita={cuotaVisita}
          />

          <MejorCuotaBanner
            mercado={mejorCuota.mercado}
            casa={mejorCuota.casa}
            cuota={mejorCuota.cuota}
          />

          <div className="resumen-pick-socios">
            <div className="resumen-pick-socios-title">
              💎 Análisis Socios bloqueado
            </div>
            <div className="resumen-pick-socios-desc">
              Mercados con value · combinadas óptimas · stake sugerido ·
              razonamiento estadístico completo
            </div>
            <div className="resumen-pick-socios-blur">{ceboCombinada}</div>
            <a className="resumen-pick-socios-cta" href="/socios">
              {ctaSocios}
            </a>
          </div>
        </div>
      </AuthGate>

      {/* ===== Resumen ejecutivo · SOCIOS (desbloqueado) ===== */}
      <AuthGate state="socios">
        <div className="resumen-ejecutivo">
          <RecomendBlock
            label="Pronóstico Habla! · gratis"
            value={`${labelGana} · ${probSeleccionada}% prob`}
            cuota={mejorCuota.cuota}
          />

          <ProbGrid
            pron={pronostico}
            probLocal={probLocal}
            probEmpate={probEmpate}
            probVisita={probVisita}
            cuotaLocal={cuotaLocal}
            cuotaEmpate={cuotaEmpate}
            cuotaVisita={cuotaVisita}
          />

          <MejorCuotaBanner
            mercado={mejorCuota.mercado}
            casa={mejorCuota.casa}
            cuota={mejorCuota.cuota}
          />

          {combinadaOptima ? (
            <PickSociosUnlocked combinada={combinadaOptima} />
          ) : null}
        </div>
      </AuthGate>
    </>
  );
}

function RecomendBlock({
  label,
  value,
  cuota,
}: {
  label: string;
  value: string;
  cuota: number;
}) {
  return (
    <div className="resumen-recomend">
      <div>
        <div className="resumen-recomend-label">{label}</div>
        <div className="resumen-recomend-value">{value}</div>
      </div>
      <div className="resumen-recomend-cuota">{cuota.toFixed(2)}</div>
    </div>
  );
}

function ProbGrid({
  pron,
  probLocal,
  probEmpate,
  probVisita,
  cuotaLocal,
  cuotaEmpate,
  cuotaVisita,
}: {
  pron: "LOCAL" | "EMPATE" | "VISITA";
  probLocal: number;
  probEmpate: number;
  probVisita: number;
  cuotaLocal: number | null;
  cuotaEmpate: number | null;
  cuotaVisita: number | null;
}) {
  return (
    <div className="resumen-prob-grid">
      <ProbCell
        label="Local"
        pct={probLocal}
        cuota={fmtCuota(cuotaLocal)}
        selected={pron === "LOCAL"}
      />
      <ProbCell
        label="Empate"
        pct={probEmpate}
        cuota={fmtCuota(cuotaEmpate)}
        selected={pron === "EMPATE"}
      />
      <ProbCell
        label="Visita"
        pct={probVisita}
        cuota={fmtCuota(cuotaVisita)}
        selected={pron === "VISITA"}
      />
    </div>
  );
}

function fmtCuota(c: number | null): string {
  return c !== null ? c.toFixed(2) : "—";
}

function ProbCell({
  label,
  pct,
  cuota,
  selected,
}: {
  label: string;
  pct: number;
  cuota: string;
  selected: boolean;
}) {
  return (
    <div className={`resumen-prob${selected ? " selected" : ""}`}>
      <div className="resumen-prob-label">
        {label}
        {selected ? " ✓" : ""}
      </div>
      <div className="resumen-prob-val">{pct}%</div>
      <div className="resumen-prob-cuota">@ {cuota}</div>
    </div>
  );
}

function MejorCuotaBanner({
  mercado,
  casa,
  cuota,
}: {
  mercado: string;
  casa: string;
  cuota: number;
}) {
  // El label refleja el mercado del pronóstico (Local/Empate/Visita), no
  // hardcoded a "Local". Mockup line 2834.
  const labelMercado =
    mercado.toUpperCase() === "EMPATE"
      ? "Empate"
      : mercado.toUpperCase() === "VISITA"
        ? "Visita"
        : "Local";
  return (
    <div className="resumen-mejor-cuota">
      <div style={{ fontSize: 20 }}>🏆</div>
      <div className="resumen-mejor-cuota-text">
        <strong>Mejor cuota {labelMercado}</strong> ·{" "}
        <span className="resumen-mejor-cuota-casa">
          {casa} @ {cuota.toFixed(2)}
        </span>
      </div>
      <button type="button" className="btn btn-primary btn-sm">
        Apostar →
      </button>
    </div>
  );
}

function PickSociosUnlocked({ combinada }: { combinada: CombinadaOptima }) {
  return (
    <div className="pick-socios-unlocked">
      <div className="pick-socios-unlocked-header">
        <div className="pick-socios-unlocked-title">
          💎 Análisis Socios · desbloqueado
        </div>
        <span className="badge badge-gold">EV+ {combinada.evPlus.toFixed(1)}%</span>
      </div>
      <div className="pick-socios-recomend">
        <div>
          <div className="pick-socios-recomend-label">Combinada recomendada</div>
          <div className="pick-socios-recomend-value">{combinada.pronostico}</div>
        </div>
        <div className="pick-socios-recomend-cuota">{combinada.cuotaTotal.toFixed(2)}</div>
      </div>
      <div className="pick-socios-stake">
        <div className="pick-socios-stake-item">
          🏠 <strong>{combinada.casa}</strong>
        </div>
        <div className="pick-socios-stake-item">
          💰 Stake <strong>{combinada.stake}</strong>
        </div>
        <div className="pick-socios-stake-item">
          📊 EV+ <strong>+{combinada.evPlus.toFixed(1)}%</strong>
        </div>
        {combinada.confianza !== null && combinada.confianza !== undefined ? (
          <div className="pick-socios-stake-item">
            🎯 Confianza <strong>{combinada.confianza}%</strong>
          </div>
        ) : null}
      </div>
      {combinada.razonamiento ? (
        <p className="pick-socios-razon">
          <strong>Razonamiento:</strong> {combinada.razonamiento}
        </p>
      ) : null}
      {combinada.mercadosExtra && combinada.mercadosExtra.length > 0 ? (
        <div className="pick-socios-mercados-extra">
          <div className="pick-socios-mercados-extra-title">
            Otros mercados con value
          </div>
          <div className="pick-socios-mercados-grid">
            {combinada.mercadosExtra.map((m) => (
              <div key={m.mercado} className="pick-socios-mercado-extra">
                <strong>{m.mercado}</strong> @ {m.cuota.toFixed(2)}
                {m.ev !== null && m.ev !== undefined ? (
                  <div className="pick-socios-mercado-extra-ev">
                    EV+ {m.ev.toFixed(1)}% · {m.casa}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
