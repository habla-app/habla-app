"use client";
// VerificacionSection — sólo email (verificación nativa de NextAuth/Resend)
// tras Lote 1 cleanup. Las cards de teléfono y DNI fueron retiradas: el
// pivot a editorial/comunidad/afiliación no requiere verificación adicional.

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { SectionShell } from "./SectionShell";

interface Props {
  perfil: PerfilCompleto;
}

export function VerificacionSection({ perfil }: Props) {
  return (
    <SectionShell
      title="Verificación de cuenta"
      subtitle="Confirmación de los datos básicos de tu cuenta"
      icon="🛡️"
      iconTone="verif"
    >
      <VerifRow
        done={!!perfil.emailVerified}
        title="Correo electrónico"
        desc={
          perfil.emailVerified
            ? `${perfil.email} · Verificado al registrarte`
            : perfil.email
        }
      />
      <VerifRow
        done={!!perfil.fechaNac}
        title="Edad (+18)"
        desc={
          perfil.fechaNac
            ? "Edad confirmada por fecha de nacimiento"
            : "Falta confirmar fecha de nacimiento"
        }
      />
    </SectionShell>
  );
}

function VerifRow({
  done,
  title,
  desc,
}: {
  done: boolean;
  title: string;
  desc: string;
}) {
  const iconCls = done
    ? "bg-alert-success-bg text-alert-success-text"
    : "bg-urgent-med-bg text-urgent-high-dark";
  return (
    <div className="flex items-center gap-3.5 border-b border-light px-5 py-3.5 last:border-b-0">
      <div
        aria-hidden
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ${iconCls}`}
      >
        {done ? "✓" : "!"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-dark">{title}</div>
        <div className="text-xs leading-[1.4] text-muted-d">{desc}</div>
      </div>
      {done ? (
        <span className="flex-shrink-0 rounded-full bg-alert-success-bg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-alert-success-text">
          ✓ Verificado
        </span>
      ) : null}
    </div>
  );
}
