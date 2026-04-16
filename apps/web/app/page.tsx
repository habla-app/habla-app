// Home — Server Component. El NavBar lee la sesion; el contenido interactivo
// vive en HomeContent (Client Component).
import { NavBar } from "@/components/layout/NavBar";
import { HomeContent } from "@/components/home/HomeContent";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <NavBar />
      <HomeContent />
    </div>
  );
}
