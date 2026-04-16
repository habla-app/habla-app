"use client";

// Modal contextual que aparece cuando un usuario no logueado intenta
// inscribirse a un torneo. Muestra info del torneo (motivacional) y
// redirige a /auth/login con callbackUrl al torneo.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Torneo {
  id?: string;
  nombre: string;
  partido: { equipoLocal: string; equipoVisita: string };
  entradaLukas: number;
  pozoBruto: number;
}

interface ModalLoginInscripcionProps {
  isOpen: boolean;
  onClose: () => void;
  torneo: Torneo | null;
}

export function ModalLoginInscripcion({
  isOpen,
  onClose,
  torneo,
}: ModalLoginInscripcionProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const irALogin = () => {
    const callbackUrl = torneo?.id ? `/torneo/${torneo.id}` : "/";
    router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-brand-border bg-brand-card p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-border sm:hidden" />

        {/* Boton cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-card2 hover:text-white"
        >
          &#10005;
        </button>

        {/* Contenido */}
        <div className="text-center">
          <div className="mb-2 text-5xl">&#127919;</div>
          <h2 className="mb-2 font-display text-2xl font-black uppercase text-white">
            &iexcl;&Uacute;nete a Habla!
          </h2>
          <p className="mb-6 text-sm text-brand-muted">
            Reg&iacute;strate y recibe{" "}
            <span className="font-bold text-brand-gold">500 Lukas de regalo</span>{" "}
            para tu primera combinada.
          </p>

          {torneo && (
            <div className="mb-6 rounded-xl border border-brand-border bg-brand-card2 p-4 text-left">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                {torneo.nombre}
              </div>
              <div className="mb-3 font-display text-base font-extrabold uppercase text-white">
                {torneo.partido.equipoLocal} vs {torneo.partido.equipoVisita}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-brand-muted">
                    Pozo
                  </div>
                  <div className="font-display text-lg font-black text-brand-gold">
                    {torneo.pozoBruto.toLocaleString("es-PE")} &#129689;
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-brand-muted">
                    Entrada
                  </div>
                  <div className="font-display text-lg font-black text-white">
                    {torneo.entradaLukas} &#129689;
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={irALogin}
            className="mb-3 w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-brand-gold-light"
          >
            Continuar con email
          </button>

          <p className="text-[11px] leading-relaxed text-brand-muted">
            Al registrarte aceptas los{" "}
            <span className="text-brand-gold">T&eacute;rminos</span> &middot; Mayores
            de 18 a&ntilde;os
          </p>
        </div>
      </div>
    </div>
  );
}
