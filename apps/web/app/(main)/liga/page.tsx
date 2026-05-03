// /liga — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (líneas 3054-3517).
//
// Estructura del mockup:
//   container
//     .liga-hero (LigaHero)
//     .como-funciona (ComoFuncionaLiga, colapsable)
//     .section-bar + .premios-grid (PremiosGrid)
//     .section-bar + table.ranking-table (RankingMensualTabla)
//     .liga-section x3 (LigaSeccion: próximos / vivo / terminados)

import { auth } from "@/lib/auth";
import {
  PREMIO_PRIMER_PUESTO,
  obtenerLeaderboardMesActual,
} from "@/lib/services/leaderboard.service";
import { obtenerListaLiga } from "@/lib/services/liga.service";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { LigaHero } from "@/components/liga/LigaHero";
import { ComoFuncionaLiga } from "@/components/liga/ComoFuncionaLiga";
import { PremiosGrid } from "@/components/liga/PremiosGrid";
import { RankingMensualTabla } from "@/components/liga/RankingMensualTabla";
import { LigaSeccion } from "@/components/liga/LigaSeccion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "La Liga Habla! · Compite por S/ 1,250 al mes · Habla!",
  description:
    "Predicí gratis por cada partido elegible. Editá tu combinada hasta el kickoff. El Top 10 del mes cobra en efectivo por Yape.",
};

export default async function LigaPage() {
  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;

  const [vista, listaLiga] = await Promise.all([
    obtenerLeaderboardMesActual({ usuarioIdActual }),
    obtenerListaLiga(usuarioIdActual),
  ]);

  const nombreMesCap = capitalize(vista.nombreMes);
  const ahora = new Date();
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  const diasAlCierre = Math.max(
    0,
    Math.ceil((finMes.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const filasLeaderboard = vista.filas.map((f) => ({
    posicion: f.posicion,
    userId: f.userId,
    username: f.username,
    puntos: f.puntos,
  }));
  const miFilaFueraDelTop =
    vista.miFila && vista.miFila.posicion > 10
      ? {
          posicion: vista.miFila.posicion,
          userId: vista.miFila.userId,
          username: vista.miFila.username,
          puntos: vista.miFila.puntos,
        }
      : null;

  return (
    <div className="mockup-container">
      <TrackOnMount
        event="liga_lista_vista"
        props={{
          mes: vista.mes,
          totalUsuarios: vista.totalUsuarios,
          proximos: listaLiga.proximos.length,
          enVivo: listaLiga.enVivo.length,
          terminados: listaLiga.terminados.length,
        }}
      />

      <LigaHero
        nombreMes={nombreMesCap}
        totalTipsters={vista.totalUsuarios}
        premioPrimerPuesto={PREMIO_PRIMER_PUESTO}
        diasAlCierre={diasAlCierre}
      />

      <ComoFuncionaLiga />

      <PremiosGrid />

      <div className="section-bar" style={{ marginTop: 24 }}>
        <div className="section-bar-left">
          <div className="section-bar-icon">📈</div>
          <div>
            <div className="section-bar-title">Ranking del mes</div>
            <div className="section-bar-subtitle">
              {vista.totalUsuarios.toLocaleString("es-PE")} tipsters compitiendo
              · actualizado en tiempo real
            </div>
          </div>
        </div>
        <a className="section-bar-cta" href="/liga/mes">
          Ver Top 100 →
        </a>
      </div>
      <RankingMensualTabla
        filas={filasLeaderboard}
        miUserId={usuarioIdActual ?? null}
        miFilaFueraDelTop={miFilaFueraDelTop}
      />

      <div id="proximos" />
      <LigaSeccion
        titulo="Próximos partidos"
        subtitulo="Editá hasta el kickoff"
        icono="🔜"
        partidos={listaLiga.proximos}
        variante="proximo"
        vacio="No hay partidos elegibles próximos. El admin va eligiendo de los próximos 7 días."
      />

      <LigaSeccion
        titulo="En vivo ahora"
        subtitulo={
          listaLiga.enVivo.length > 0
            ? `${listaLiga.enVivo.length} partido${listaLiga.enVivo.length === 1 ? "" : "s"} en curso · ranking actualizado en tiempo real`
            : undefined
        }
        icono="●"
        partidos={listaLiga.enVivo}
        variante="vivo"
      />

      <LigaSeccion
        titulo="Terminados · últimos 7 días"
        subtitulo="Resultados finales y ganadores"
        icono="✓"
        partidos={listaLiga.terminados}
        variante="terminado"
      />

      <p
        style={{
          marginTop: 24,
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted-d)",
          lineHeight: 1.6,
        }}
      >
        🎲 Apostar es entretenimiento, no una fuente de ingresos. Si sentís que
        perdiste el control, contactá la Línea Tugar al{" "}
        <a
          href="tel:0800-19009"
          style={{ color: "var(--blue-main)", textDecoration: "underline" }}
        >
          0800-19009
        </a>
        .
      </p>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
