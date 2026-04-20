// Landing pública — comparte contenido con `/matches`. Data real desde el
// servicio de torneos. Click en body del MatchCard → /torneo/{id}; click
// en CTA "Crear combinada" → ComboModal inline (o /auth/login si no hay
// sesión, con callback a / preservando filtros + ?openCombo=<id>).
//
// Hotfix #7 Bug #17: `force-dynamic` por la misma razón que /matches —
// el sidebar con widget en vivo y la lista de torneos dependen de
// estado que puede cambiar entre requests (poller + cierre de torneos).
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

interface Props {
  searchParams?: { liga?: string; dia?: string };
}

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: Props) {
  return (
    <MatchesPageContent
      ligaSlug={searchParams?.liga}
      dia={searchParams?.dia}
      basePath="/"
    />
  );
}
