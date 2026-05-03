// Footer — Lote S v3.2 · portación literal del `<footer class="app-footer">`
// del mockup (docs/habla-mockup-v3.2.html líneas 4745-4785).
//
// 4 columnas: Producto · Habla! · Legal · Ayuda.
// Disclaimer único con: Juega responsablemente + +18 + Línea Tugar 0800-19009
// + medio editorial independiente con afiliación MINCETUR + © 2026.
//
// Las clases CSS son las del mockup (definidas en mockup-styles.css por el
// Lote R). Cero Tailwind utility, cero componentes UI custom.
//
// Los `<a>` del mockup sin href se enlazan en la app a las URLs reales:
//   - "Las Fijas"           → /las-fijas
//   - "La Liga Habla!"      → /liga
//   - "Socios"              → /socios
//   - "Reviews y Guías"     → /reviews-y-guias
//   - "Sobre nosotros"      → /ayuda/faq#sobre-nosotros (sin page propia aún)
//   - "Contacto"            → /ayuda/faq#contacto
//   - "Newsletter"          → /ayuda/faq#newsletter
//   - "Términos"            → /legal/terminos
//   - "Privacidad"          → /legal/privacidad
//   - "Cookies"             → /legal/cookies
//   - "Juego responsable"   → /legal/juego-responsable
//   - "Centro de ayuda"     → /ayuda/faq
//   - "Libro de reclamaciones" → /legal/libro-reclamaciones (placeholder)

import Link from "next/link";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-grid">
        <div>
          <h4>Producto</h4>
          <ul>
            <li>
              <Link href="/las-fijas">Las Fijas</Link>
            </li>
            <li>
              <Link href="/liga">La Liga Habla!</Link>
            </li>
            <li>
              <Link href="/socios">Socios</Link>
            </li>
            <li>
              <Link href="/reviews-y-guias">Reviews y Guías</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Habla!</h4>
          <ul>
            <li>
              <Link href="/ayuda/faq#sobre-nosotros">Sobre nosotros</Link>
            </li>
            <li>
              <Link href="/ayuda/faq#contacto">Contacto</Link>
            </li>
            <li>
              <Link href="/ayuda/faq#newsletter">Newsletter</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li>
              <Link href="/legal/terminos">Términos</Link>
            </li>
            <li>
              <Link href="/legal/privacidad">Privacidad</Link>
            </li>
            <li>
              <Link href="/legal/cookies">Cookies</Link>
            </li>
            <li>
              <Link href="/legal/juego-responsable">Juego responsable</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Ayuda</h4>
          <ul>
            <li>
              <Link href="/ayuda/faq">Centro de ayuda</Link>
            </li>
            <li>
              <Link href="/legal/libro-reclamaciones">Libro de reclamaciones</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="app-footer-disclaimer">
        <strong>Juega responsablemente.</strong> Solo +18. Línea Tugar (gratuita): 0800-19009. Habla! es un medio editorial independiente; recibimos comisiones por afiliación con casas autorizadas MINCETUR.<br />
        © 2026 Habla! — Todos los derechos reservados.
      </div>
    </footer>
  );
}
