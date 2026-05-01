// PremiumTeaserHome — sección Premium en la home (Lote D actualiza).
// Refactor del Lote B: ahora delega 100% en `<PickWrapper>` con un pick
// aprobado real cargado por el server component padre. Si Premium activo
// → no se renderiza (oculto en la home). Si no Premium → wrapper decide
// teaser bloqueado / fallback "Próximamente".
//
// El componente queda como fachada para mantener la importación estable
// en `app/(public)/page.tsx`. La lógica vive en `<PickWrapper>`.

import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";
import { PickWrapper, type PickWrapperData } from "@/components/ui/premium";

interface Props {
  estado: EstadoUsuario;
  pick: PickWrapperData | null;
}

export function PremiumTeaserHome({ estado, pick }: Props) {
  if (estado === "premium") return null;

  return (
    <section
      aria-label="Pick Premium del día"
      className="mb-12"
    >
      <PickWrapper
        pick={pick}
        estadoUsuario={estado}
        mode="card"
        utmSource="home"
      />
    </section>
  );
}
