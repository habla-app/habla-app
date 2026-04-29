// `/matches` — canónica del listado de torneos. Misma vista que `/`.
// El layout (main) aporta NavBar + BottomNav.
//
// Hotfix #7 Bug #17: `force-dynamic` para que Next.js NO cachee el RSC
// entre requests. Sin esto el widget "🔴 En vivo ahora" del sidebar
// quedaba pegado con datos del primer render (partido finalizado
// mostrado como live, partido recién entrado en vivo invisible).
// Mismo motivo que el Hotfix #2 Bug #3 aplicó a /mis-combinadas: los RSC
// que dependen de estado en vivo (lista de torneos, partidos live) deben
// renderizarse en cada request.
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

interface Props {
  searchParams?: { liga?: string; dia?: string };
}

export const dynamic = "force-dynamic";

export default async function MatchesPage({ searchParams }: Props) {
  return (
    <MatchesPageContent
      ligaSlug={searchParams?.liga}
      dia={searchParams?.dia}
    />
  );
}
