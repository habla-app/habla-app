// /perfil — rediseño desde cero (Abr 2026) alineado 1:1 con el mockup
// (docs/habla-mockup-completo.html líneas 3851-4300).
//
// Estructura:
//   1. Header con título + subtítulo
//   2. ProfileHero (avatar + nivel + progreso)
//   3. StatsGrid (6 stats)
//   4. QuickAccessGrid (4 accesos)
//   5. VerificacionSection (email, edad, teléfono, DNI)
//   6. DatosSection (nombre, @handle read-only, correo, teléfono, fecha, ubicación)
//   7. NotificacionesSection (7 toggles)
//   8. JuegoResponsableSection (límites + auto-exclusión)
//   9. FooterSections (Seguridad, Ayuda, Legal, Danger zone)
//
// Acceso: UserMenu (desktop, 2 clicks) + BottomNav item "Perfil" (mobile, 1 tap).
// Middleware protege la ruta + fuerza /auth/completar-perfil si username
// no lockeado.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerMiPerfil } from "@/lib/services/usuarios.service";
import { obtenerPreferencias } from "@/lib/services/notificaciones.service";
import { obtenerLimites } from "@/lib/services/limites.service";
import { ProfileHero } from "@/components/perfil/ProfileHero";
import { StatsGrid } from "@/components/perfil/StatsGrid";
import { QuickAccessGrid } from "@/components/perfil/QuickAccessGrid";
import { VerificacionSection } from "@/components/perfil/VerificacionSection";
import { DatosSection } from "@/components/perfil/DatosSection";
import { NotificacionesSection } from "@/components/perfil/NotificacionesSection";
import { JuegoResponsableSection } from "@/components/perfil/JuegoResponsableSection";
import { FooterSections } from "@/components/perfil/FooterSections";
import { PerfilRefreshOnUpdate } from "@/components/perfil/PerfilRefreshOnUpdate";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/perfil");

  const [perfil, preferencias, limites] = await Promise.all([
    obtenerMiPerfil(session.user.id),
    obtenerPreferencias(session.user.id),
    obtenerLimites(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          Mi perfil
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Gestioná tu cuenta, verificación, notificaciones y preferencias de
          juego
        </p>
      </header>

      <PerfilRefreshOnUpdate />

      <ProfileHero perfil={perfil} />
      <StatsGrid perfil={perfil} />
      <QuickAccessGrid />

      <VerificacionSection perfil={perfil} />
      <DatosSection perfil={perfil} />
      <NotificacionesSection inicial={preferencias} />
      <JuegoResponsableSection inicial={limites} />
      <FooterSections email={perfil.email} />
    </div>
  );
}
