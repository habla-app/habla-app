// Home — Lote N v3.2 · portación literal del `<section id="page-home">`
// del mockup (docs/habla-mockup-v3.2.html líneas 2212-2547).
//
// 3 estados de hero (visitor / free / socios) intercalados con AuthGate +
// 3 secciones peek (Encuentra las fijas, La Liga peek, Socios peek).
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarFijas } from "@/lib/services/las-fijas.service";
import {
  obtenerLeaderboardMesActual,
  PREMIO_PRIMER_PUESTO,
} from "@/lib/services/leaderboard.service";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";
import { AuthGate } from "@/components/auth/AuthGate";
import { HomeHeroSocios } from "@/components/home/HomeHeroSocios";
import { HomeHeroFree } from "@/components/home/HomeHeroFree";
import { fechaHora } from "@/components/home/cell-helpers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Habla! · Todas las fijas en una",
  description:
    "Pronósticos deportivos, comparador de cuotas, La Liga Habla! con S/ 1,250 al mes en premios y Socios con picks por WhatsApp Channel.",
  alternates: { canonical: "/" },
};

const LIGA_ICON: Record<string, string> = {
  "Premier League": "🏆",
  "La Liga": "🏆",
  "Serie A": "🏆",
  "Bundesliga": "🏆",
  "Ligue 1": "🏆",
  "Champions League": "🏆",
  "Liga 1 Perú": "🇵🇪",
  "Liga 1": "🇵🇪",
  "Copa Libertadores": "🏆",
  "Copa Sudamericana": "🏆",
};

function ligaIcon(liga: string): string {
  return LIGA_ICON[liga] ?? "🏆";
}

function favLabel(p: "LOCAL" | "EMPATE" | "VISITA" | null): string {
  if (p === "LOCAL") return "Local";
  if (p === "EMPATE") return "Empate";
  if (p === "VISITA") return "Visita";
  return "—";
}

function pctLabel(prob: number | null): string {
  if (prob === null) return "—";
  return `${Math.round(prob * 100)}% prob`;
}

function fmtCuota(c: number | null): string {
  if (c === null) return "—";
  return c.toFixed(2);
}

function siglaCasa(casa: string | null): string {
  if (!casa) return "—";
  const c = casa.toLowerCase();
  if (c.includes("betano")) return "BT";
  if (c.includes("betsson")) return "BS";
  if (c.includes("coolbet")) return "CB";
  if (c.includes("doradobet")) return "DR";
  if (c.includes("1xbet")) return "1X";
  if (c.includes("te apuesto")) return "TA";
  return casa.slice(0, 2).toUpperCase();
}

function colorCasa(casa: string | null): string | undefined {
  if (!casa) return undefined;
  const c = casa.toLowerCase();
  if (c.includes("betano")) return "#DC2626";
  if (c.includes("betsson")) return "#0EA5E9";
  if (c.includes("coolbet")) return "#059669";
  if (c.includes("doradobet")) return "#0A2080";
  if (c.includes("1xbet")) return "#FF7A00";
  if (c.includes("te apuesto")) return "#DC2626";
  return undefined;
}

function over25Fav(over: number | null, under: number | null): {
  result: string;
  pct: number | null;
} {
  if (over === null && under === null) return { result: "—", pct: null };
  // En el mockup el % no es exactamente 1/cuota — es la prob aproximada.
  // Usamos 1/cuota como aproximación visible.
  const probOver = over !== null ? 1 / over : null;
  const probUnder = under !== null ? 1 / under : null;
  if (probOver !== null && (probUnder === null || probOver >= probUnder)) {
    return { result: "Más", pct: probOver };
  }
  if (probUnder !== null) {
    return { result: "Menos", pct: probUnder };
  }
  return { result: "—", pct: null };
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const username = session?.user?.username ?? null;
  const estadoAuth = await obtenerEstadoAuthServer(userId);

  const [fijas, leaderboard] = await Promise.all([
    listarFijas({ limit: 5 }),
    obtenerLeaderboardMesActual({ usuarioIdActual: userId ?? undefined }),
  ]);

  const top5 = leaderboard.filas.slice(0, 5);
  const totalTipsters = leaderboard.totalUsuarios;
  const diasAlCierre = diasHastaCierreMes();
  const miPosicion = leaderboard.miFila?.posicion ?? null;

  return (
    <div className="container">

      {/* Hero · server-side branching para evitar queries innecesarias en cada
          variante. Las clases visitor-only/logged-only/socios-only del mockup
          quedan en el HTML por consistencia con el CSS portado. */}
      {estadoAuth === "visitor" ? (
        <div className="home-hero visitor-only">
          <div className="home-hero-eyebrow">⚽ Pronósticos · Liga · Comunidad</div>
          <h1>Todas las fijas<br />en una</h1>
          <p className="home-hero-desc">
            Comunidad de pronósticos deportivos. Encuentra las mejores fijas y compite con la comunidad para ver quién acierta más.
          </p>
          <div className="home-hero-ctas">
            <Link href="/auth/signin" className="btn btn-primary">Empezar gratis →</Link>
            <Link href="/las-fijas" className="btn btn-ghost">Ver las fijas</Link>
          </div>
        </div>
      ) : estadoAuth === "free" ? (
        <HomeHeroFree username={username} miPosicion={miPosicion} />
      ) : (
        <HomeHeroSocios username={username} />
      )}

      {/* Sección 1: Encuentra las fijas (peek) */}
      <section style={{ marginBottom: 32 }}>
        <div className="section-bar">
          <div className="section-bar-left">
            <div className="section-bar-icon">🎯</div>
            <div>
              <div className="section-bar-title">Encuentra las fijas</div>
              <div className="section-bar-subtitle">Próximos partidos · favorito · ±2.5 goles · mejor cuota</div>
            </div>
          </div>
          <Link href="/las-fijas" className="section-bar-cta">Ver todas →</Link>
        </div>

        <div className="fijas-table-wrap">
          <table className="fijas-table">
            <thead>
              <tr>
                <th>Liga · Hora</th>
                <th>Partido</th>
                <th>Favorito</th>
                <th>±2.5 goles</th>
                <th>Mejor cuota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fijas.map((fija) => {
                const over = over25Fav(
                  fija.cuotasSnapshot?.over25 ?? null,
                  fija.cuotasSnapshot?.under25 ?? null,
                );
                const bestCuota = (() => {
                  const pron = fija.pronostico1x2;
                  const snap = fija.cuotasSnapshot;
                  if (!snap) return null;
                  if (pron === "LOCAL") return snap.local;
                  if (pron === "EMPATE") return snap.empate;
                  if (pron === "VISITA") return snap.visita;
                  return null;
                })();
                const bestCasa = fija.cuotasSnapshot?.bestCasa ?? null;
                const sigla = fija.cuotasSnapshot?.bestSigla ?? siglaCasa(bestCasa);
                const color = fija.cuotasSnapshot?.bestColor ?? colorCasa(bestCasa);
                return (
                  <tr key={fija.id}>
                    <td>
                      <div className="cell-liga">{ligaIcon(fija.liga)} {fija.liga}</div>
                      <div className="cell-hora">{fechaHora(fija.fechaInicio)}</div>
                    </td>
                    <td><div className="cell-equipos">{fija.equipoLocal} <span className="vs">vs</span> {fija.equipoVisita}</div></td>
                    <td>
                      <div className="cell-fav">
                        <span className="cell-fav-result">{favLabel(fija.pronostico1x2)}</span>
                        <span className="cell-fav-pct">{pctLabel(fija.probabilidadPronostico)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-fav">
                        <span className="cell-fav-result">{over.result}</span>
                        <span className="cell-fav-pct">{pctLabel(over.pct)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-casa">
                        <div className="casa-mini-logo" style={color ? { background: color } : undefined}>{sigla}</div>
                        <span className="cell-cuota">{fmtCuota(bestCuota)}</span>
                      </div>
                    </td>
                    <td>
                      <Link href={`/las-fijas/${fija.slug}`} className="cta-fila">Ver fija</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="fijas-table-foot">
            <Link href="/las-fijas" className="btn btn-ghost btn-sm">Ver las fijas del fin de semana →</Link>
          </div>
        </div>
      </section>

      {/* Sección 2: La Liga peek */}
      <section style={{ marginBottom: 32 }}>
        <div className="liga-card-home">
          <div className="liga-card-home-header">
            <div>
              <div className="liga-card-eyebrow">🏆 Liga Habla! · {capitalize(leaderboard.nombreMes)}</div>
              <h2>Compite gratis<br />por S/ 1,250</h2>
            </div>
          </div>
          <p className="liga-card-home-desc">
            Armá tu combinada de 5 predicciones por partido. Suma puntos. El Top 10 del mes cobra en efectivo. Solo registrarse.
          </p>

          <div className="liga-stats-row">
            <div className="liga-stat">
              <div className="liga-stat-value">{totalTipsters.toLocaleString("es-PE")}</div>
              <div className="liga-stat-label">Tipsters compitiendo</div>
            </div>
            <div className="liga-stat">
              <div className="liga-stat-value">S/ {PREMIO_PRIMER_PUESTO}</div>
              <div className="liga-stat-label">Premio 1° puesto</div>
            </div>
            <div className="liga-stat">
              <div className="liga-stat-value">{diasAlCierre} días</div>
              <div className="liga-stat-label">Para el cierre</div>
            </div>
          </div>

          <div className="liga-top-mini">
            {top5.length === 0 ? (
              <div className="liga-top-mini-row">
                <div className="liga-top-rank">—</div>
                <div className="liga-top-name">Sé el primero del mes</div>
                <div className="liga-top-pts">0 pts</div>
              </div>
            ) : (
              top5.map((fila) => (
                <div key={fila.userId} className="liga-top-mini-row">
                  <div className={fila.posicion === 1 ? "liga-top-rank gold" : "liga-top-rank"}>{fila.posicion}°</div>
                  <div className="liga-top-name">@{fila.username}</div>
                  <div className="liga-top-pts">{fila.puntos} pts</div>
                </div>
              ))
            )}
          </div>

          <AuthGate state="visitor">
            <Link
              href="/auth/signup?utm=home_liga_card"
              className="btn btn-primary btn-block visitor-only"
            >
              Sumarme gratis →
            </Link>
          </AuthGate>
          <AuthGate not="visitor">
            <Link
              href="/liga"
              className="btn btn-primary btn-block logged-only"
            >
              Armar mi próxima combinada →
            </Link>
          </AuthGate>
        </div>
      </section>

      {/* Sección 3: Socios peek (solo Visitor/Free) */}
      <AuthGate not="socios">
        <section className="not-socios-only" style={{ marginBottom: 24 }}>
          <div className="socios-card-home">
            <div className="socios-card-home-eyebrow">💎 Socios Habla!</div>
            <h2>Picks por WhatsApp</h2>
            <p className="socios-card-home-desc">
              Te enviamos 2-4 picks de valor por día con razonamiento estadístico. La fija final, directo a tu canal privado.
            </p>

            <ul className="socios-bullets">
              <li><span className="socios-bullet-check">✓</span> 2-4 picks/día con razonamiento (datos H2H, forma, EV+)</li>
              <li><span className="socios-bullet-check">✓</span> Casa con mejor cuota incluida en cada pick</li>
              <li><span className="socios-bullet-check">✓</span> Bot 24/7 en WhatsApp para dudas</li>
            </ul>

            <div className="socios-planes-mini">
              <div className="plan-mini">
                <div className="plan-mini-label">Mensual</div>
                <div className="plan-mini-price">S/49</div>
                <div className="plan-mini-period">por mes</div>
              </div>
              <div className="plan-mini featured">
                <div className="plan-mini-label">Anual −32%</div>
                <div className="plan-mini-price">S/33</div>
                <div className="plan-mini-period">por mes</div>
              </div>
              <div className="plan-mini">
                <div className="plan-mini-label">Trimestral</div>
                <div className="plan-mini-price">S/40</div>
                <div className="plan-mini-period">por mes</div>
              </div>
            </div>

            <Link href="/socios" className="btn btn-primary btn-block">Conocer Socios →</Link>
          </div>
        </section>
      </AuthGate>

    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diasHastaCierreMes(): number {
  const ahora = new Date();
  const tzLima = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const fin = new Date(tzLima.getFullYear(), tzLima.getMonth() + 1, 1);
  const dias = Math.ceil((fin.getTime() - tzLima.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, dias);
}
