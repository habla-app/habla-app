// /perfil/eliminar/confirmar — consume el token de email + ejecuta soft delete.
// Sub-Sprint 7. Esta ruta es pública (el token ya autentica la acción) porque
// el usuario puede estar sin sesión al clickear el link.

import { ConfirmarEliminarContent } from "@/components/perfil/ConfirmarEliminarContent";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { token?: string };
}

export default function ConfirmarEliminarPage({ searchParams }: PageProps) {
  const token = searchParams.token ?? "";
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <ConfirmarEliminarContent token={token} />
    </div>
  );
}
