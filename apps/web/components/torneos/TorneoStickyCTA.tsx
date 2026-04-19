"use client";
// TorneoStickyCTA — CTA del detalle del torneo con posición sticky en
// mobile (fija al bottom, arriba del BottomNav) y normal en desktop.
// Hotfix #5 Bug #13.
//
// Delega al `ComboLauncher` (que usa el hook `useComboOpener`) para
// abrir el modal. La decisión de qué variante renderizar (combo, link
// a /live-match, disabled) viene del view-model:
// `TorneoDetailCta` (puro, testeado).

import Link from "next/link";
import { ComboLauncher } from "@/components/combo/ComboLauncher";
import type { TorneoDetailCta } from "@/lib/utils/torneo-detail-view";

interface Props {
  torneoId: string;
  hasSession: boolean;
  cta: TorneoDetailCta;
  /** Path base del caller para armar el callbackUrl post-login. */
  callbackUrl: string;
}

export function TorneoStickyCTA({
  torneoId,
  hasSession,
  cta,
  callbackUrl,
}: Props) {
  // Wrapper que hace que el CTA se fije al bottom del viewport en
  // mobile (arriba del BottomNav de 60px) y quede normal en desktop.
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-light bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,16,80,.08)] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
      data-testid="torneo-sticky-cta"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="mx-auto max-w-[960px]">
        <CtaInner
          cta={cta}
          torneoId={torneoId}
          hasSession={hasSession}
          callbackUrl={callbackUrl}
        />
      </div>
    </div>
  );
}

function CtaInner({
  cta,
  torneoId,
  hasSession,
  callbackUrl,
}: {
  cta: TorneoDetailCta;
  torneoId: string;
  hasSession: boolean;
  callbackUrl: string;
}) {
  if (cta.kind === "combo") {
    // Delega al ComboLauncher compartido — mismo patrón que
    // MatchCardCTA y AutoOpenComboFromQuery (§14 CLAUDE.md).
    return (
      <ComboLauncher
        torneoId={torneoId}
        hasSession={hasSession}
        callbackUrl={callbackUrl}
        label={cta.label}
        variant={cta.variant}
        className="w-full"
      />
    );
  }

  if (cta.kind === "link") {
    const href = cta.href.replace(
      "__LIVE_HREF__",
      `/live-match?torneoId=${torneoId}`,
    );
    return (
      <Link
        href={href}
        data-testid="torneo-cta-link"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue-main px-6 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-white shadow-md transition-all hover:-translate-y-px hover:bg-brand-blue-light"
      >
        {cta.label}
      </Link>
    );
  }

  if (cta.kind === "disabled") {
    return (
      <button
        type="button"
        disabled
        data-testid="torneo-cta-disabled"
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-light bg-subtle px-6 py-4 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-muted-d opacity-70"
        title={cta.reason}
      >
        {cta.label}
      </button>
    );
  }

  // cta.kind === "info"
  const toneCls =
    cta.tone === "warning"
      ? "border-alert-info-border bg-alert-info-bg text-alert-info-text"
      : "border-light bg-card text-body";
  return (
    <div
      className={`rounded-md border px-5 py-4 text-center text-[14px] font-semibold ${toneCls}`}
      data-testid="torneo-cta-info"
    >
      {cta.label}
    </div>
  );
}
