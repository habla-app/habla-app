"use client";
// MatchCardCTA — botón lateral dorado del MatchCard que dispara el
// ComboModal inline (sin salir de /matches).
//
// Hotfix 19 Abr (Bug #2): antes era un `<Link href="/torneo/:id">` dentro
// del MatchCard server component, lo que forzaba al usuario a navegar
// para armar su combinada. Ahora:
//   - Con sesión  → botón que abre ComboModal en el mismo /matches.
//   - Sin sesión  → link a /auth/signin?callbackUrl=/matches?openCombo=<id>.
//                   Post-login el AutoOpenComboFromQuery lee ese query
//                   param y re-abre el modal automáticamente.
//
// Styling replicado 1:1 desde el `<Link>` original: h-12 full-width en
// mobile, 110px lateral en desktop. Usa el hook `useComboOpener` para
// compartir lógica con ComboLauncher.

import Link from "next/link";
import { ComboModal } from "@/components/combo/ComboModal";
import { useComboOpener } from "@/hooks/useComboOpener";

interface MatchCardCTAProps {
  torneoId: string;
  hasSession: boolean;
  /** URL a la que volver tras login. Debe incluir `?openCombo=<torneoId>`
   *  para que el AutoOpenComboFromQuery detecte la intención y re-abra el
   *  modal automáticamente post-login. */
  callbackUrl: string;
}

// Clases del botón/link. Extraídas a constante para poder cubrirlas con
// tests de regresión (verifica que el styling quede idéntico al <Link>
// original y que el layering z-index > body link funcione).
export const MATCH_CARD_CTA_CLASSES =
  "group/cta relative z-20 flex h-12 w-full flex-shrink-0 items-center justify-center gap-2 bg-brand-gold font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-dark transition-all duration-150 hover:bg-brand-gold-light hover:shadow-gold disabled:cursor-wait disabled:opacity-80 sm:h-auto sm:w-[110px] sm:flex-col sm:gap-1.5 sm:px-3 sm:text-[12px]";

export function MatchCardCTA({
  torneoId,
  hasSession,
  callbackUrl,
}: MatchCardCTAProps) {
  // Sin sesión → link directo al login. No renderizamos el modal; el
  // modal vive en AutoOpenComboFromQuery (montado a nivel de
  // MatchesPageContent) que se activa al volver con ?openCombo=<id>.
  if (!hasSession) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        aria-label="Crear combinada"
        data-testid="match-card-cta"
        className={MATCH_CARD_CTA_CLASSES}
      >
        <CTABody />
      </Link>
    );
  }

  return <AuthedCTA torneoId={torneoId} />;
}

function AuthedCTA({ torneoId }: { torneoId: string }) {
  const { modalProps, openFor, loading } = useComboOpener();

  return (
    <>
      <button
        type="button"
        onClick={() => openFor(torneoId)}
        disabled={loading}
        aria-label="Crear combinada"
        data-testid="match-card-cta"
        className={MATCH_CARD_CTA_CLASSES}
      >
        <CTABody loading={loading} />
      </button>
      <ComboModal {...modalProps} />
    </>
  );
}

function CTABody({ loading = false }: { loading?: boolean }) {
  if (loading) {
    return (
      <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em]">
        Cargando…
      </span>
    );
  }
  return (
    <>
      <TargetIcon />
      <span className="hidden text-center leading-tight sm:inline">
        Crear
        <br />
        combinada
      </span>
      <span className="inline sm:hidden">Crear combinada</span>
      <ArrowIcon />
    </>
  );
}

// SVG inlines — mismo diseño que el CTA original. Los stroke hex se
// mantienen como en el `<Link>` previo (son atributos SVG, no Tailwind).
function TargetIcon() {
  return (
    <svg
      viewBox="0 0 22 22"
      width="22"
      height="22"
      fill="none"
      stroke="#001050"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <circle cx="11" cy="11" r="4" />
      <circle cx="11" cy="11" r="1" fill="#001050" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="#001050"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-transform duration-150 group-hover/cta:translate-x-0.5 sm:hidden"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
