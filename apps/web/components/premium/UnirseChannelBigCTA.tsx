"use client";

// UnirseChannelBigCTA — el componente más importante del post-pago (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.
//
// Card grande con icono de WhatsApp + título "Únete al Channel" + botón XL
// verde con deep link al Channel privado. Click dispatcha
// `whatsapp_channel_link_clickeado` y abre el deep link en WhatsApp / nueva
// tab.

import { track } from "@/lib/analytics";

interface Props {
  channelInviteLink: string | null;
}

export function UnirseChannelBigCTA({ channelInviteLink }: Props) {
  const linkOk = !!channelInviteLink;

  const handleClick = () => {
    track("whatsapp_channel_link_clickeado", {
      source: "post-pago",
      linkOk,
    });
  };

  return (
    <section
      aria-label="Únete al WhatsApp Channel"
      className="bg-card px-4 py-7 text-center"
    >
      <div
        aria-hidden
        className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-whatsapp-green text-white shadow-2xl"
        style={{ boxShadow: "0 12px 30px rgba(37,211,102,.3)" }}
      >
        <span className="text-3xl">💬</span>
      </div>
      <h2 className="font-display text-display-md font-extrabold text-dark">
        Únete al Channel
      </h2>
      <p className="mx-auto mt-1 max-w-[280px] text-body-sm leading-snug text-muted-d">
        {linkOk
          ? "Solo 1 click para empezar a recibir los picks. El link se abrirá en WhatsApp."
          : "Estamos creando tu invitación al Channel. Te enviaremos un email con el link en los próximos minutos."}
      </p>

      {linkOk ? (
        <a
          href={channelInviteLink!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-whatsapp-green px-5 py-4 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-white transition-all hover:-translate-y-px"
          style={{ boxShadow: "0 8px 20px rgba(37,211,102,.4)" }}
        >
          📱 Unirme a Habla! Picks
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="touch-target mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-muted-d/30 px-5 py-4 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-white opacity-60"
        >
          Preparando el Channel…
        </button>
      )}
      <p className="mt-2 text-body-xs text-muted-d">
        Canal privado · Solo suscriptores Premium
      </p>
    </section>
  );
}
