"use client";

// Modal contextual que aparece cuando un usuario no logueado intenta
// inscribirse a un torneo. Muestra info del torneo (motivacional) y
// redirige a /auth/login con callbackUrl al torneo.
//
// Phase 2: rediseño a light surface per mockup v5 (panel claro centrado,
// overlay con blur, shadow-xl).
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md animate-scale-in rounded-t-xl border border-light bg-card p-6 shadow-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-strong sm:hidden"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-d transition-colors hover:bg-subtle hover:text-dark"
        >
          ✕
        </button>

        <div className="text-center">
          <div aria-hidden className="mb-2 text-5xl">
            🎯
          </div>
          <h2 className="mb-2 font-display text-2xl font-black uppercase tracking-wide text-dark">
            ¡Únete a Habla!
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-body">
            Regístrate y recibe{" "}
            <span className="font-bold text-brand-gold-dark">
              500 Lukas de regalo
            </span>{" "}
            para tu primera combinada.
          </p>

          {torneo && (
            <div className="mb-6 rounded-md border border-light bg-subtle p-4 text-left">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-d">
                {torneo.nombre}
              </div>
              <div className="mb-3 font-display text-base font-extrabold uppercase text-dark">
                {torneo.partido.equipoLocal} vs {torneo.partido.equipoVisita}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-d">
                    Pozo
                  </div>
                  <div className="font-display text-lg font-black leading-none text-brand-gold-dark">
                    {torneo.pozoBruto.toLocaleString("es-PE")}{" "}
                    <span aria-hidden>🪙</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-d">
                    Entrada
                  </div>
                  <div className="font-display text-lg font-black leading-none text-dark">
                    {torneo.entradaLukas} <span aria-hidden>🪙</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={irALogin}
            className="mb-3 w-full rounded-sm bg-brand-gold px-4 py-3.5 font-display text-sm font-extrabold uppercase tracking-wider text-black shadow-gold transition-all hover:-translate-y-0.5 hover:bg-brand-gold-light"
          >
            Continuar con email
          </button>

          <p className="text-[11px] leading-relaxed text-muted-d">
            Al registrarte aceptas los{" "}
            <span className="font-semibold text-brand-blue-main">Términos</span>{" "}
            · Mayores de 18 años
          </p>
        </div>
      </div>
    </div>
  );
}
