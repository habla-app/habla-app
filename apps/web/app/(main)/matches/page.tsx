// `/matches` — canónica del listado de torneos. Misma vista que `/`.
// El layout (main) aporta NavBar + BottomNav.
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

interface Props {
  searchParams?: { liga?: string; dia?: string };
}

export default async function MatchesPage({ searchParams }: Props) {
  return (
    <MatchesPageContent
      ligaSlug={searchParams?.liga}
      dia={searchParams?.dia}
    />
  );
}
