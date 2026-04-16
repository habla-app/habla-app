// Layout para rutas autenticadas (/wallet, /perfil, /admin).
// Incluye NavBar con sesion — el BottomNav se reserva para la home.
import { NavBar } from "@/components/layout/NavBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <NavBar />
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
