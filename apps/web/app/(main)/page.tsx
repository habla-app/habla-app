// Landing pública — comparte contenido con `/matches`. Data real desde el
// servicio de torneos. Click en body del MatchCard → /torneo/{id}; click
// en CTA "Crear combinada" → ComboModal inline (o /auth/login si no hay
// sesión, con callback a / preservando filtros + ?openCombo=<id>).
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

interface Props {
  searchParams?: { liga?: string; dia?: string };
}

export default async function HomePage({ searchParams }: Props) {
  return (
    <MatchesPageContent
      ligaSlug={searchParams?.liga}
      dia={searchParams?.dia}
      basePath="/"
    />
  );
}
