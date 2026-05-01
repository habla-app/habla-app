"use client";

// QuickAccessGrid — accesos rápidos del perfil (Lote C v3.1, refactor del
// Lote 11). Spec: docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// 4 cards default (Mis predicciones, Referidos, Newsletter, Soporte).
// Si el usuario es Premium, se agrega la 5ta card "Mi suscripción".
// Si NO es Premium, debajo aparece el `<PremiumStatusCard>` (renderizado
// por la page).
//
// El acceso "Mi link de referido" abre `<ReferidoModal>` (modal con copy
// del link + share intents nativos WhatsApp/Twitter).

import Link from "next/link";
import { useState } from "react";
import { ReferidoModal } from "./ReferidoModal";

interface QuickAccessGridProps {
  username: string;
  esPremium?: boolean;
}

export function QuickAccessGrid({
  username,
  esPremium = false,
}: QuickAccessGridProps) {
  const [openReferido, setOpenReferido] = useState(false);

  return (
    <>
      <nav
        aria-label="Accesos rápidos"
        className="grid grid-cols-2 gap-2.5 px-4 py-2"
      >
        <Card
          icon="🎯"
          iconBg="bg-brand-gold-dim"
          title="Mis predicciones"
          sub="Tu histórico"
          href="/mis-predicciones"
        />
        <button
          type="button"
          onClick={() => setOpenReferido(true)}
          className="flex touch-target items-center gap-2.5 rounded-md border border-light bg-card p-3 text-left shadow-sm transition-all hover:border-brand-gold hover:shadow-md active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-blue-main/10 text-[18px]"
          >
            🤝
          </span>
          <div className="min-w-0">
            <p className="font-display text-display-xs font-bold text-dark">
              Mi link de referido
            </p>
            <p className="text-label-md text-muted-d">Compartir</p>
          </div>
        </button>
        <Card
          icon="📬"
          iconBg="bg-alert-info-bg"
          title="Newsletter"
          sub="Suscripciones"
          href="/perfil#notificaciones"
        />
        <Card
          icon="💬"
          iconBg="bg-alert-success-bg"
          title="Soporte"
          sub="FAQ y contacto"
          href="/ayuda/faq"
        />
        {esPremium && (
          <Card
            icon="💎"
            iconBg="bg-brand-gold-dim"
            title="Mi suscripción"
            sub="Plan y pagos"
            href="/premium/mi-suscripcion"
          />
        )}
      </nav>

      <ReferidoModal
        username={username}
        open={openReferido}
        onClose={() => setOpenReferido(false)}
      />
    </>
  );
}

function Card({
  icon,
  iconBg,
  title,
  sub,
  href,
}: {
  icon: string;
  iconBg: string;
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex touch-target items-center gap-2.5 rounded-md border border-light bg-card p-3 shadow-sm transition-all hover:border-brand-gold hover:shadow-md active:scale-[0.99]"
    >
      <span
        aria-hidden
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${iconBg} text-[18px]`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-display-xs font-bold text-dark">
          {title}
        </p>
        <p className="text-label-md text-muted-d">{sub}</p>
      </div>
    </Link>
  );
}
