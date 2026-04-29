"use client";
// VerificacionSection — sólo email tras Lote 3. NextAuth verifica el email
// en el sign-in (Google OAuth o magic link Resend) y no requerimos
// verificación adicional en el modelo editorial/comunidad/afiliación. Las
// cards de teléfono, DNI y "+18" se retiraron junto con el flujo monetario.

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { SectionShell } from "./SectionShell";

interface Props {
  perfil: PerfilCompleto;
}

export function VerificacionSection({ perfil }: Props) {
  const verificado = !!perfil.emailVerified;
  const iconCls = verificado
    ? "bg-alert-success-bg text-alert-success-text"
    : "bg-urgent-med-bg text-urgent-high-dark";
  return (
    <SectionShell
      title="Verificación de cuenta"
      subtitle="Confirmación del correo asociado a tu cuenta"
      icon="🛡️"
      iconTone="verif"
    >
      <div className="flex items-center gap-3.5 border-b border-light px-5 py-3.5 last:border-b-0">
        <div
          aria-hidden
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ${iconCls}`}
        >
          {verificado ? "✓" : "!"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-dark">Correo electrónico</div>
          <div className="text-xs leading-[1.4] text-muted-d">
            {verificado
              ? `${perfil.email} · Verificado al registrarte`
              : perfil.email}
          </div>
        </div>
        {verificado ? (
          <span className="flex-shrink-0 rounded-full bg-alert-success-bg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-alert-success-text">
            ✓ Verificado
          </span>
        ) : null}
      </div>
    </SectionShell>
  );
}
