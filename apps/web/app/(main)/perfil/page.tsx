// Perfil — Server Component. Avatar + datos del usuario + botón cerrar sesión.
// NavBar lo aporta (main)/layout.tsx. Este page es placeholder hasta el
// Sub-Sprint 7 que construye el perfil completo (hero + stats + niveles).
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CerrarSesionBoton } from "@/components/auth/CerrarSesionBoton";

function iniciales(nombre: string | null | undefined, email: string): string {
  const base = nombre && nombre.trim().length > 0 ? nombre : email;
  const partes = base.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/perfil");

  const { name, email, balanceLukas, rol } = session.user;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-dark">
          👤 Mi perfil
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Gestiona tu cuenta, verificación, notificaciones y preferencias de juego.
        </p>
      </header>

      {/* Hero del perfil con avatar y datos */}
      <section className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-diagonal font-display text-3xl font-extrabold text-black shadow-gold"
          >
            {iniciales(name, email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-2xl font-black uppercase text-white">
              {name || email}
            </div>
            <div className="truncate text-xs text-white/70">{email}</div>
            <div className="mt-1 inline-block rounded-full bg-brand-gold-dim px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold">
              {rol === "ADMIN" ? "Administrador" : "Jugador"}
            </div>
          </div>
        </div>
      </section>

      {/* Balance */}
      <section className="mt-4 rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-d">
          Balance actual
        </div>
        <div className="mt-1 font-display text-4xl font-black leading-none text-brand-gold-dark">
          {(balanceLukas ?? 0).toLocaleString("es-PE")} Lukas
        </div>
        <div className="mt-1 text-[11px] text-muted-d">
          El detalle de movimientos vive en{" "}
          <span className="font-semibold text-brand-blue-main">Billetera</span>.
        </div>
      </section>

      {/* Placeholder perfil completo (Sub-Sprint 7) */}
      <section className="mt-4 rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-dark">
          Próximamente: gestión completa
        </h2>
        <p className="mt-2 text-sm text-body">
          En el Sub-Sprint 7 habilitamos verificación de teléfono/DNI,
          preferencias de notificaciones, límites de juego responsable y
          gestión de cuenta.
        </p>
      </section>

      <div className="mt-6">
        <CerrarSesionBoton />
      </div>
    </div>
  );
}
