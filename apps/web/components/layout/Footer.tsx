// Footer global — visible en todas las páginas públicas y autenticadas.
//
// 4 columnas en desktop, una columna apilada en móvil. Fondo dark
// (mismo tono que el header) para anclar visualmente y separar del
// contenido. Padding generoso, separador 1px arriba.
//
// Lote 3.

import Link from "next/link";

const LEGAL_LINKS: Array<{ label: string; href: string }> = [
  { label: "Términos y Condiciones", href: "/legal/terminos" },
  { label: "Política de Privacidad", href: "/legal/privacidad" },
  { label: "Política de Cookies", href: "/legal/cookies" },
  { label: "Juego Responsable", href: "/legal/juego-responsable" },
  { label: "Canjes y Devoluciones", href: "/legal/canjes" },
  { label: "Aviso Legal", href: "/legal/aviso" },
];

const PRODUCTO_LINKS: Array<{ label: string; href: string }> = [
  { label: "Torneos abiertos", href: "/matches" },
  { label: "En vivo ahora", href: "/live-match" },
  { label: "Tienda de premios", href: "/tienda" },
  { label: "Centro de ayuda", href: "/ayuda/faq" },
];

export function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark-surface text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-4 lg:gap-8 lg:py-20">
        {/* Col 1 — Marca */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gold-radial text-[18px] font-black text-black shadow-gold"
            >
              ⊕
            </span>
            <span className="font-display text-[26px] font-black">Habla!</span>
          </div>
          <p className="mb-3 font-display text-[15px] font-bold uppercase tracking-wider text-brand-gold">
            Predice. Compite. Gana.
          </p>
          <p className="text-[14px] leading-[1.6] text-dark-muted">
            Torneos de predicciones de fútbol en Perú. Tu conocimiento del
            juego, contra el de otros jugadores.
          </p>
        </div>

        {/* Col 2 — Producto */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-white">
            Producto
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            {PRODUCTO_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white hover:underline underline-offset-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Legal */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-white">
            Legal
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white hover:underline underline-offset-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4 — Contacto */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-white">
            Contacto
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            <li>
              <span className="block text-[12px] uppercase tracking-wide text-dark-muted/70">
                Soporte
              </span>
              <a
                href="mailto:soporte@hablaplay.com"
                className="text-white transition-colors hover:text-brand-gold"
              >
                soporte@hablaplay.com
              </a>
            </li>
            <li>
              <span className="block text-[12px] uppercase tracking-wide text-dark-muted/70">
                Legal
              </span>
              <a
                href="mailto:legal@hablaplay.com"
                className="text-white transition-colors hover:text-brand-gold"
              >
                legal@hablaplay.com
              </a>
            </li>
            <li className="flex items-center gap-2 text-dark-muted/70">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="opacity-60"
              >
                <path d="M20.52 3.48A11.86 11.86 0 0 0 12 0a11.86 11.86 0 0 0-10.18 17.95L0 24l6.27-1.65A11.86 11.86 0 0 0 12 24a11.86 11.86 0 0 0 8.52-20.52zM12 21.82a9.78 9.78 0 0 1-4.99-1.36l-.36-.21-3.72.97 1-3.62-.23-.37a9.79 9.79 0 1 1 8.3 4.6z" />
              </svg>
              <span>WhatsApp — Próximamente</span>
            </li>
            <li className="pt-3 text-[13px] text-dark-muted">
              Lima, Perú · Atención 9am–9pm
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-dark-border">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-2 px-6 py-5 text-[12px] text-dark-muted/80 md:flex-row md:items-center">
          <p>© 2026 Habla! — Todos los derechos reservados.</p>
          <Link
            href="/legal/aviso"
            className="hover:text-white hover:underline underline-offset-2"
          >
            Aviso legal
          </Link>
        </div>
      </div>
    </footer>
  );
}
