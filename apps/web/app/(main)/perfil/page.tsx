// /perfil — Sub-Sprint 7.
// Estructura siguiendo §10.8 del CLAUDE.md:
//   1. Profile hero con nivel
//   2. Stats grid (6 pills)
//   3. Quick access (4 cards)
//   4. Verificación
//   5. Datos personales
//   6. Preferencias de notificaciones
//   7. Juego responsable
//   8. Datos y privacidad
//   9. Danger zone (cerrar sesión)

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { obtenerMiPerfil } from "@/lib/services/usuarios.service";
import { obtenerPreferencias } from "@/lib/services/notificaciones.service";
import { obtenerLimites } from "@/lib/services/limites.service";
import { CerrarSesionBoton } from "@/components/auth/CerrarSesionBoton";
import { ProfileHero } from "@/components/perfil/ProfileHero";
import { StatsGrid } from "@/components/perfil/StatsGrid";
import { VerificacionPanel } from "@/components/perfil/VerificacionPanel";
import { DatosPersonalesPanel } from "@/components/perfil/DatosPersonalesPanel";
import { PreferenciasPanel } from "@/components/perfil/PreferenciasPanel";
import { LimitesPanel } from "@/components/perfil/LimitesPanel";
import { DatosYPrivacidadPanel } from "@/components/perfil/DatosYPrivacidadPanel";
import { PerfilRefreshOnUpdate } from "@/components/perfil/PerfilRefreshOnUpdate";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/perfil");

  const [perfil, preferencias, limites] = await Promise.all([
    obtenerMiPerfil(session.user.id),
    obtenerPreferencias(session.user.id),
    obtenerLimites(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-[32px] font-black uppercase leading-none tracking-[0.01em] text-dark md:text-[40px]">
          👤 Mi perfil
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Gestioná tu cuenta, verificación, notificaciones y preferencias.
        </p>
      </header>

      <PerfilRefreshOnUpdate />

      <ProfileHero perfil={perfil} initialBalance={perfil.balanceLukas} />

      <StatsGrid perfil={perfil} />

      {/* Quick access — 4 cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAccess href="/mis-combinadas" icon="🎯" label="Mis combinadas" />
        <QuickAccess href="/wallet" icon="💰" label="Billetera" />
        <QuickAccess href="/tienda" icon="🎁" label="Tienda" />
        <QuickAccess href="/faq" icon="❓" label="Ayuda" />
      </section>

      <VerificacionPanel perfil={perfil} onActualizar={() => {}} />
      <DatosPersonalesPanel perfil={perfil} onActualizar={() => {}} />
      <PreferenciasPanel inicial={preferencias} />
      <LimitesPanel inicial={limites} />
      <DatosYPrivacidadPanel balanceLukas={perfil.balanceLukas} />

      {/* Sección ayuda + legal */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Ayuda y legal
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] md:grid-cols-4">
          <LegalLink href="/como-jugar" label="Cómo jugar" />
          <LegalLink href="/faq" label="FAQ" />
          <LegalLink href="/legal/terminos" label="Términos" />
          <LegalLink href="/legal/privacidad" label="Privacidad" />
          <LegalLink href="/legal/juego-responsable" label="Juego responsable" />
          <LegalLink href="/legal/lukas" label="Sobre los Lukas" />
          <LegalLink href="/legal/acerca" label="Acerca de Habla!" />
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-6 rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-dark">
              Cerrar sesión
            </h2>
            <p className="text-[12px] text-muted-d">
              Salí de tu cuenta en este dispositivo.
            </p>
          </div>
          <CerrarSesionBoton />
        </div>
      </section>

      <footer className="py-6 text-center text-[12px] text-muted-d">
        Habla! v1.0 · Hecho en Perú 🇵🇪
      </footer>
    </div>
  );
}

function QuickAccess({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 rounded-md border border-light bg-card p-4 text-center transition-colors hover:bg-hover"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-[13px] font-bold text-dark">{label}</span>
    </a>
  );
}

function LegalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded-md px-3 py-2 text-body transition-colors hover:bg-hover"
    >
      {label}
    </a>
  );
}
