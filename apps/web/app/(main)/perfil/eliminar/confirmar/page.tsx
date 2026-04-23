// /perfil/eliminar/confirmar?token=XXX — página pública que recibe el
// click del email de solicitud de eliminación. El cliente despacha el
// POST a /api/v1/usuarios/me/eliminar/confirmar con el token recibido
// y muestra un feedback visual.
//
// No requiere sesión — el token mismo es el bearer de autorización.
// force-dynamic porque depende de searchParams.

import { ConfirmarEliminarContent } from "@/components/perfil/ConfirmarEliminarContent";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { token?: string };
}

export default function ConfirmarEliminarPage({ searchParams }: Props) {
  return <ConfirmarEliminarContent token={searchParams.token ?? null} />;
}
