// Footer global — visible en todas las páginas públicas y autenticadas.
//
// Lote 11 (May 2026): rediseño 4 columnas (Marca + redes / Producto /
// Editorial / Legal). Bloque inferior con disclaimers obligatorios:
// MINCETUR/afiliación, mayoría de edad, datos legales (RUC + razón
// social) leídos de env vars. Pages legales/ayuda que aún no existan
// quedan apuntadas como `/legal/...` o `/ayuda/...` con placeholder de
// "Próximamente" — completadas en Lote 15.

import Link from "next/link";

const PRODUCTO_LINKS: Array<{ label: string; href: string }> = [
  { label: "Pronósticos", href: "/pronosticos" },
  { label: "Casas autorizadas", href: "/casas" },
  { label: "Comunidad", href: "/comunidad" },
  { label: "Cuotas", href: "/cuotas" },
  { label: "Newsletter", href: "/suscribir" },
];

const EDITORIAL_LINKS: Array<{ label: string; href: string }> = [
  { label: "Blog", href: "/blog" },
  { label: "Guías", href: "/guias" },
  { label: "Análisis del Mundial", href: "/blog?tag=mundial" },
  { label: "Liga 1 Perú", href: "/blog?tag=liga-1" },
];

const LEGAL_LINKS: Array<{ label: string; href: string }> = [
  { label: "Términos y Condiciones", href: "/legal/terminos" },
  { label: "Política de Privacidad", href: "/legal/privacidad" },
  { label: "Política de Cookies", href: "/legal/cookies" },
  { label: "Compras y devoluciones", href: "/legal/canjes" },
  { label: "Aviso Legal", href: "/legal/aviso" },
  { label: "Juego Responsable", href: "/legal/juego-responsable" },
  { label: "Centro de ayuda", href: "/ayuda/faq" },
  { label: "Libro de Reclamaciones", href: "/legal/libro-reclamaciones" },
];

const REDES_SOCIALES: Array<{
  label: string;
  href: string;
  icon: React.ReactNode;
}> = [
  {
    label: "Instagram",
    href: "https://instagram.com/hablaplay",
    icon: <IconInstagram />,
  },
  {
    label: "Twitter",
    href: "https://twitter.com/hablaplay",
    icon: <IconTwitter />,
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@hablaplay",
    icon: <IconTikTok />,
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@hablaplay",
    icon: <IconYouTube />,
  },
];

export function Footer() {
  // Datos legales se leen de env vars; si no están seteadas, omitimos la
  // línea (no rompemos el build). Gustavo las completa en Railway durante
  // el Lote 15.
  // Lote 11: las env vars `LEGAL_*` ya estaban listadas en CLAUDE.md
  // desde antes; las consumimos acá para el footer global. Si faltan,
  // omitimos la línea sin romper el build.
  const ruc = process.env.LEGAL_RUC?.trim() ?? "";
  const razonSocial = process.env.LEGAL_RAZON_SOCIAL?.trim() ?? "";
  const domicilio = process.env.LEGAL_DOMICILIO_FISCAL?.trim() ?? "";
  const tieneDatosLegales = ruc && razonSocial;

  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-dark-border bg-dark-surface text-white">
      {/* GRID 4 COLUMNAS */}
      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-4 lg:gap-8 lg:py-20">
        {/* Col 1 — Marca + redes */}
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
          <p className="mb-4 text-[14px] leading-[1.6] text-dark-muted">
            Comunidad gratuita de pronósticos deportivos en Perú.
          </p>
          <ul className="flex items-center gap-2.5">
            {REDES_SOCIALES.map((r) => (
              <li key={r.label}>
                <a
                  href={r.href}
                  aria-label={r.label}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-dark-border text-white/70 transition-colors hover:border-brand-gold hover:text-brand-gold"
                >
                  {r.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 2 — Producto */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-brand-gold">
            Producto
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            {PRODUCTO_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Editorial */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-brand-gold">
            Editorial
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            {EDITORIAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4 — Legal */}
        <div>
          <h3 className="mb-4 font-display text-[13px] font-bold uppercase tracking-wider text-brand-gold">
            Legal
          </h3>
          <ul className="space-y-2.5 text-[14px] text-dark-muted">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* DISCLAIMERS BAR */}
      <div className="border-t border-dark-border">
        <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-8">
          {/* DisclaimerLudopatia inline (variante dark del componente
              `components/mdx/DisclaimerLudopatia.tsx`). El texto y el
              número son los oficiales del Lote 7 — confirmar antes de
              cambiar. */}
          <aside
            role="note"
            aria-label="Aviso legal: juego responsable"
            className="flex items-start gap-2.5 rounded-md border border-dark-border bg-dark-card/50 px-5 py-4 text-[12px] leading-[1.65] text-dark-muted"
          >
            <span aria-hidden className="flex-shrink-0 text-[15px]">
              ℹ️
            </span>
            <p className="m-0">
              <strong className="text-white">Juega responsablemente.</strong>{" "}
              Solo +18 años. Si crees que tienes un problema con el juego,
              llama a la línea gratuita 0800-1-2025 (MINCETUR).
            </p>
          </aside>

          <p className="text-[12px] leading-[1.65] text-dark-muted">
            Habla! es un medio editorial independiente. Recibimos comisiones
            por afiliación con casas de apuestas autorizadas por MINCETUR.
            Las cuotas mostradas son referenciales — la cuota final la
            confirma cada operador al momento de tu apuesta.
          </p>

          <p className="text-[12px] font-bold leading-[1.5] text-brand-gold">
            +18 · Solo para mayores de edad. Apostar puede ser adictivo.
            Línea gratuita MINCETUR: 0800-1-2025.
          </p>

          {tieneDatosLegales ? (
            <p className="text-[11px] leading-[1.5] text-dark-muted/80">
              {razonSocial} · RUC {ruc}
              {domicilio ? ` · ${domicilio}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {/* COPYRIGHT */}
      <div className="border-t border-dark-border">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-2 px-6 py-5 text-[12px] text-dark-muted/80 md:flex-row md:items-center">
          <p>© {year} Habla! — Todos los derechos reservados.</p>
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

// ---------------------------------------------------------------------------
// Iconos de redes sociales (lucide-style, inline SVG para evitar nuevas deps)
// ---------------------------------------------------------------------------

function IconInstagram() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function IconTwitter() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.55a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.0z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
