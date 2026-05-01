// AccesosRapidosPremium — grid 2x2 con accesos del Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// Diferencia con `<SiguientesPasosPremium>` del post-pago: aquí el primer
// acceso es "Mi Channel" con icono verde WhatsApp + deep link.

"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

interface Props {
  channelInviteLink: string | null;
  botPhoneNumber: string | null;
}

interface Acceso {
  href: string;
  icono: string;
  titulo: string;
  detalle: string;
  external?: boolean;
  iconClassName?: string;
  onClick?: () => void;
}

export function AccesosRapidosPremium({
  channelInviteLink,
  botPhoneNumber,
}: Props) {
  const accesos: Array<Acceso> = [
    {
      href: channelInviteLink ?? "#",
      icono: "💬",
      titulo: "Mi Channel",
      detalle: channelInviteLink ? "Habla! Picks" : "Próximamente",
      external: !!channelInviteLink,
      iconClassName: "bg-whatsapp-green text-white",
      onClick: channelInviteLink
        ? () =>
            track("whatsapp_channel_link_clickeado", {
              source: "mi-suscripcion",
              linkOk: true,
            })
        : undefined,
    },
    {
      href: botPhoneNumber
        ? `https://wa.me/${botPhoneNumber.replace(/\D/g, "")}`
        : "/ayuda/faq",
      icono: "🤖",
      titulo: "Bot FAQ",
      detalle: "Dudas 24/7",
      external: !!botPhoneNumber,
    },
    {
      href: "/cuotas",
      icono: "📊",
      titulo: "Picks pasados",
      detalle: "Histórico web",
    },
    {
      href: "/ayuda/faq",
      icono: "💬",
      titulo: "Soporte",
      detalle: "FAQ + chat",
    },
  ];

  return (
    <section
      aria-label="Accesos rápidos Premium"
      className="grid grid-cols-2 gap-2 px-4 pb-3"
    >
      {accesos.map((a) => (
        <AccessCard key={a.titulo} acceso={a} />
      ))}
    </section>
  );
}

function AccessCard({ acceso }: { acceso: Acceso }) {
  const className =
    "touch-target flex items-center gap-2.5 rounded-md border border-light bg-card p-3 transition-colors hover:bg-hover";

  const content = (
    <>
      <span
        aria-hidden
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-base ${
          acceso.iconClassName ?? "bg-subtle"
        }`}
      >
        {acceso.icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-display-xs font-bold text-dark">
          {acceso.titulo}
        </p>
        <p className="text-[10px] leading-tight text-muted-d">
          {acceso.detalle}
        </p>
      </div>
    </>
  );

  if (acceso.external) {
    return (
      <a
        href={acceso.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={acceso.onClick}
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={acceso.href} className={className} onClick={acceso.onClick}>
      {content}
    </Link>
  );
}
