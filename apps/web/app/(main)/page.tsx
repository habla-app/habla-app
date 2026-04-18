// Landing pública — comparte contenido con `/matches`. Data real desde el
// servicio de torneos. CTAs de MatchCard → /torneo/{id} (público).
import { MatchesPageContent } from "@/components/matches/MatchesPageContent";

export default async function HomePage() {
  return <MatchesPageContent />;
}
