// Landing pública — comparte contenido con `/matches`. Data real desde el
// servicio de torneos. CTAs de MatchCard → /torneo/{id} (público).
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

interface Props {
  searchParams?: { liga?: string; dia?: string };
}

export default async function HomePage({ searchParams }: Props) {
  return (
    <MatchesPageContent
      ligaSlug={searchParams?.liga}
      dia={searchParams?.dia}
    />
  );
}
