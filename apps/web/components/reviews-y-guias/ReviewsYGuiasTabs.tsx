"use client";
// ReviewsYGuiasTabs — Lote N v3.2 · client component que orquesta los
// tabs "Reviews" / "Guías" de /reviews-y-guias.
//
// Estructura HTML literal del mockup (líneas 3909-4179) — `.tabs-bar`,
// `.tab-btn`, `.tab-content`, `.reviews-table`, `.review-card`,
// `.guias-tags`, `.guias-list`, `.guia-item`. Cero clases Tailwind utility.

import { useState } from "react";
import Link from "next/link";

interface MetodoPago {
  code: string;
  label: string;
  color: string;
  textColor?: string;
}

export interface CasaItem {
  slug: string;
  nombre: string;
  rating: number | null;
  bonoActual: string | null;
  metodosPago: MetodoPago[];
  cuotasRating: { label: string; tone: "green" | "orange" | "red" };
  mincetur: boolean;
  logoSigla: string;
  logoColor: string;
  reviewSlug: string;
  irHref: string;
}

export interface GuiaItem {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tag: string;
  emoji: string;
  gradient?: string;
  leerEnMin: number;
}

interface Props {
  casas: CasaItem[];
  guias: GuiaItem[];
  tagsGuias: string[];
}

export function ReviewsYGuiasTabs({ casas, guias, tagsGuias }: Props) {
  const [tab, setTab] = useState<"reviews" | "guias">("reviews");
  const [tagActivo, setTagActivo] = useState<string>("Todas");

  const guiasFiltradas =
    tagActivo === "Todas"
      ? guias
      : guias.filter((g) => g.tag === tagActivo);

  return (
    <>
      {/* Tabs */}
      <div className="tabs-bar">
        <button
          className={tab === "reviews" ? "tab-btn active" : "tab-btn"}
          data-tab="reviews"
          onClick={() => setTab("reviews")}
          type="button"
        >
          📊 Reviews de casas
        </button>
        <button
          className={tab === "guias" ? "tab-btn active" : "tab-btn"}
          data-tab="guias"
          onClick={() => setTab("guias")}
          type="button"
        >
          📚 Guías
        </button>
      </div>

      {/* ===== TAB REVIEWS ===== */}
      {tab === "reviews" ? (
        <div className="tab-content" id="tab-reviews">

          {/* Filtros */}
          <div className="fijas-filters" style={{ position: "static", marginBottom: 16, padding: 0, border: 0, background: "transparent" }}>
            <button className="filter-chip active" type="button">Todas</button>
            <button className="filter-chip" type="button">Por calificación</button>
            <button className="filter-chip" type="button">Por bono</button>
            <button className="filter-chip" type="button">Acepta Yape</button>
            <button className="filter-chip" type="button">Acepta PLIN</button>
            <input className="filter-search" placeholder="🔎 Buscar casa..." />
          </div>

          {/* Tabla desktop */}
          <table className="reviews-table">
            <thead>
              <tr>
                <th>Casa</th>
                <th>Calificación</th>
                <th>Bono bienvenida</th>
                <th>Métodos pago</th>
                <th>Cuotas</th>
                <th>MINCETUR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {casas.map((c) => (
                <tr key={c.slug}>
                  <td>
                    <div className="casa-cell">
                      <div className="casa-logo" style={{ background: c.logoColor }}>{c.logoSigla}</div>
                      <div className="casa-name">{c.nombre}</div>
                    </div>
                  </td>
                  <td>
                    <div className="casa-rating">
                      <span className="star">★</span> {c.rating !== null ? c.rating.toFixed(1) : "—"}
                    </div>
                  </td>
                  <td className="bono-cell">{c.bonoActual ?? "—"}</td>
                  <td>
                    <div className="metodos-icons">
                      {c.metodosPago.map((m) => (
                        <div
                          key={m.code}
                          className="metodo-icon"
                          style={{ background: m.color, color: m.textColor ?? "#fff" }}
                          title={m.label}
                        >
                          {m.code}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: c.cuotasRating.tone === "green" ? "var(--green)" : c.cuotasRating.tone === "orange" ? "var(--orange)" : "var(--pred-wrong)", fontWeight: 700, fontSize: 12 }}>
                      {c.cuotasRating.label}
                    </span>
                  </td>
                  <td>
                    {c.mincetur ? (
                      <span className="mincetur-check">✓ Verificado</span>
                    ) : (
                      <span style={{ color: "var(--text-muted-d)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <Link href={c.reviewSlug} className="btn btn-ghost btn-xs">Ver review</Link>
                    <a href={c.irHref} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-primary btn-xs">Ir →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cards mobile */}
          <div className="reviews-cards-mobile">
            {casas.map((c) => (
              <div key={c.slug} className="review-card">
                <div className="review-card-top">
                  <div className="casa-logo" style={{ background: c.logoColor, width: 44, height: 44, fontSize: 14 }}>{c.logoSigla}</div>
                  <div style={{ flex: 1 }}>
                    <div className="casa-name" style={{ fontSize: 15 }}>{c.nombre}</div>
                    <div className="casa-rating" style={{ fontSize: 12 }}>
                      <span className="star">★</span> {c.rating !== null ? c.rating.toFixed(1) : "—"} {c.mincetur ? "· MINCETUR ✓" : ""}
                    </div>
                  </div>
                </div>
                <div className="review-card-stats">
                  <div><div className="review-stat-label">Bono</div><div className="review-stat-value">{c.bonoActual ?? "—"}</div></div>
                  <div><div className="review-stat-label">Cuotas</div><div className="review-stat-value" style={{ color: c.cuotasRating.tone === "green" ? "var(--green)" : c.cuotasRating.tone === "orange" ? "var(--orange)" : "var(--pred-wrong)" }}>{c.cuotasRating.label}</div></div>
                  <div><div className="review-stat-label">Yape{c.metodosPago.find((m) => m.code === "PL") ? " · PLIN" : ""}</div><div className="review-stat-value">{c.metodosPago.find((m) => m.code === "YP") ? "Sí" : "—"}</div></div>
                  <div><div className="review-stat-label">Soporte</div><div className="review-stat-value">24/7</div></div>
                </div>
                <div className="review-card-actions">
                  <Link href={c.reviewSlug} className="btn btn-ghost btn-sm">Ver review</Link>
                  <a href={c.irHref} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-primary btn-sm">Ir a {c.nombre} →</a>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: "var(--text-muted-d)", marginTop: 16, lineHeight: 1.5, textAlign: "center" }}>
            Habla! recibe una comisión cuando te registrás en una casa desde nuestro sitio. Eso no cambia las cuotas que ves ni nuestras evaluaciones. Solo recomendamos casas autorizadas por MINCETUR.
          </p>
        </div>
      ) : null}

      {/* ===== TAB GUÍAS ===== */}
      {tab === "guias" ? (
        <div className="tab-content" id="tab-guias">

          {/* Filtros por tag */}
          <div className="guias-tags">
            {tagsGuias.map((t) => (
              <button
                key={t}
                className={tagActivo === t ? "guia-tag active" : "guia-tag"}
                type="button"
                onClick={() => setTagActivo(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="guias-list">
            {guiasFiltradas.map((g) => (
              <div key={g.slug} className="guia-item">
                <div
                  className="guia-item-image"
                  style={g.gradient ? { background: g.gradient } : undefined}
                >
                  {g.emoji}
                </div>
                <div className="guia-item-content">
                  <div className="guia-item-meta">{g.tag} · {formatFecha(g.publishedAt)} · {g.leerEnMin} min lectura</div>
                  <div className="guia-item-title">{g.title}</div>
                  <p className="guia-item-excerpt">{g.excerpt}</p>
                  <Link href={`/reviews-y-guias/guias/${g.slug}`} className="guia-item-cta">Leer guía →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${meses[d.getMonth()] ?? ""} ${d.getFullYear()}`;
}
