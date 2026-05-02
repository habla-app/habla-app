// PickBloqueadoSeccion — sección Premium en /partidos/[slug] (Lote D).
// Spec: docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Refactor del Lote B: delega 100% en `<PickWrapper>` mode="section".
// El componente queda como fachada estable para no romper el caller en
// `app/(public)/partidos/[slug]/page.tsx`.

import { PickWrapper, type PickWrapperData } from "@/components/ui/premium";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface Props {
  pick: PickWrapperData | null;
  estadoUsuario: EstadoUsuario;
  /** Email del usuario logueado (para watermark si Premium). */
  email?: string | null;
}

export function PickBloqueadoSeccion({ pick, estadoUsuario, email }: Props) {
  return (
    <PickWrapper
      pick={pick}
      estadoUsuario={estadoUsuario}
      mode="section"
      utmSource="partido"
      email={email}
    />
  );
}
