// /socios — Lote N v3.2 · portación literal del `<section id="page-socios">`
// del mockup (docs/habla-mockup-v3.2.html líneas 3764-3900).
//
// Landing de venta. Si el usuario es Socio activo, redirige a /socios-hub
// (decisión §4.8 del análisis-repo-vs-mockup-v3.2 — also enforced en
// middleware.ts).
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { obtenerEstadoAuthServer } from "@/lib/services/auth-state.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Socios Habla! · Picks de valor por WhatsApp",
  description:
    "Picks de valor por WhatsApp con razonamiento estadístico. Sin promesas, datos en cada pick. Garantía 7 días. Desde S/ 33/mes.",
  alternates: { canonical: "/socios" },
  openGraph: {
    type: "website",
    title: "Socios Habla! · Picks por WhatsApp",
    description:
      "Picks con razonamiento estadístico vía WhatsApp Channel privado.",
  },
};

export default async function SociosLandingPage() {
  const session = await auth();
  const estado = await obtenerEstadoAuthServer(session?.user?.id ?? null);

  // Decisión §4.8: Socio activo → redirect a /socios-hub.
  // Esta misma decisión también vive en middleware.ts (auto-redirect
  // server-side antes de pintar la landing) — esto es belt + suspenders.
  if (estado === "socios") {
    redirect("/socios-hub");
  }

  return (
    <div className="container">

      {/* Hero */}
      <div className="socios-hero">
        <div className="socios-hero-icon">💎</div>
        <h1>Socios Habla!</h1>
        <p className="socios-hero-desc">
          Picks de valor por WhatsApp. Sin promesas, datos en cada pick. La fija final, directo a tu canal privado.
        </p>
      </div>

      {/* Inclusiones */}
      <div className="socios-inclusiones">
        <h2>📦 Qué incluye tu suscripción</h2>
        <div className="socios-inclusion-list">
          <div className="socios-inclusion">
            <div className="socios-inclusion-icon">🎯</div>
            <div>
              <h3>2-4 picks por día con razonamiento</h3>
              <p>Cada pick incluye datos H2H, forma reciente, EV+ calculado y stake sugerido.</p>
            </div>
          </div>
          <div className="socios-inclusion">
            <div className="socios-inclusion-icon">🏠</div>
            <div>
              <h3>Casa con mejor cuota incluida</h3>
              <p>Te decimos en qué casa autorizada conseguir la mejor cuota disponible para cada pick.</p>
            </div>
          </div>
          <div className="socios-inclusion">
            <div className="socios-inclusion-icon">⚡</div>
            <div>
              <h3>Alertas en vivo durante partidos top</h3>
              <p>Cambios de cuotas, oportunidades y alertas de partidos que estés siguiendo.</p>
            </div>
          </div>
          <div className="socios-inclusion">
            <div className="socios-inclusion-icon">🤖</div>
            <div>
              <h3>Bot 24/7 en WhatsApp para dudas</h3>
              <p>Pregunta sobre mercados, estrategias o casas. Respuesta inmediata.</p>
            </div>
          </div>
          <div className="socios-inclusion">
            <div className="socios-inclusion-icon">📊</div>
            <div>
              <h3>Resumen semanal los lunes</h3>
              <p>Performance de los picks de la semana, aciertos y aprendizajes.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mockup canal */}
      <div className="canal-mockup">
        <div className="canal-mockup-header">
          <div className="canal-mockup-avatar">⊕</div>
          <div>
            <div className="canal-mockup-name">Habla! Picks ✓</div>
            <div className="canal-mockup-status">Canal · solo Socios</div>
          </div>
        </div>

        <div className="canal-msg">
          <strong>🎯 PICK · Premier · 09:00 PET</strong><br />
          <span style={{ color: "var(--text-dark)", fontWeight: 600 }}>Brentford vs West Ham</span>
          <div style={{ margin: "8px 0", fontSize: 12, lineHeight: 1.5 }}>
            🏆 <strong>Local + Más 2.5</strong> @ 2.10<br />
            🏠 Mejor cuota: <strong>Betano</strong><br />
            💰 Stake sugerido: 2% bankroll<br />
            📊 EV+ calculado: +8.4%
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted-d)", borderTop: "1px dashed var(--border-light)", paddingTop: 6 }}>
            Razonamiento: Brentford 4G de 5 últimos en casa, West Ham con 3 titulares fuera.
          </div>
          <div className="canal-msg-time">10:42 ✓✓</div>
        </div>

        <div className="canal-msg">
          <strong>⚡ ALERTA EN VIVO</strong><br />
          <span style={{ fontSize: 12, color: "var(--text-body)" }}>La cuota Más 2.5 subió a 1.95 en Coolbet.</span>
          <div className="canal-msg-time">11:08 ✓✓</div>
        </div>
      </div>

      {/* Planes */}
      <div className="planes-grid">
        <div className="plan-card">
          <div className="plan-name">Mensual</div>
          <div className="plan-savings">Cancela cuando quieras</div>
          <div className="plan-price">S/ 49</div>
          <div className="plan-period">por mes · sin compromiso</div>
          <Link href="/socios/checkout?plan=mensual" className="btn btn-ghost btn-block">Suscribirme</Link>
        </div>
        <div className="plan-card featured">
          <div className="plan-name">Anual</div>
          <div className="plan-savings">Ahorras 32% · S/ 33/mes</div>
          <div className="plan-price">S/ 399</div>
          <div className="plan-period">al año · 1 pago</div>
          <Link href="/socios/checkout?plan=anual" className="btn btn-primary btn-block">Suscribirme</Link>
        </div>
        <div className="plan-card">
          <div className="plan-name">Trimestral</div>
          <div className="plan-savings">Ahorras 19% · S/ 40/mes</div>
          <div className="plan-price">S/ 119</div>
          <div className="plan-period">por 3 meses</div>
          <Link href="/socios/checkout?plan=trimestral" className="btn btn-ghost btn-block">Suscribirme</Link>
        </div>
      </div>

      {/* Garantía */}
      <div className="garantia-card">
        <div className="garantia-icon">✓</div>
        <div className="garantia-text">
          <h3>Garantía de 7 días</h3>
          <p>Si no te gusta, te devolvemos el 100% sin preguntas. Sin letra chica, sin compromiso.</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="section-bar">
        <div className="section-bar-left">
          <div className="section-bar-icon">❓</div>
          <div><div className="section-bar-title">Preguntas frecuentes</div></div>
        </div>
      </div>
      <div className="faq-list">
        <div className="faq-item"><div className="faq-q">¿Cómo recibo los picks?</div></div>
        <div className="faq-item"><div className="faq-q">¿Puedo cancelar cuando quiera?</div></div>
        <div className="faq-item"><div className="faq-q">¿Qué pasa si no acierto?</div></div>
        <div className="faq-item"><div className="faq-q">¿Comparten mis datos con las casas?</div></div>
        <div className="faq-item"><div className="faq-q">¿Cuánto tiempo me toma seguir un pick?</div></div>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted-d)", margin: "24px 0 0", textAlign: "center", lineHeight: 1.5 }}>
        Apuesta responsable. Solo +18. Línea Tugar (gratuita): 0800-19009.
      </p>

    </div>
  );
}
