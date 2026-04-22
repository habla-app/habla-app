// /perfil — Sub-Sprint 7 (+ rediseño mockup v1).
//
// Estructura fiel al mockup `docs/habla-mockup-completo.html#page-perfil`:
//   1. Hero con avatar/nivel y progreso
//   2. Stats grid (6 pstat)
//   3. Quick access (4 cards con bolsa de color)
//   4. Verificación (urgent si faltan pendientes)
//   5. Datos personales (data-rows editables)
//   6. Notificaciones (7 toggles)
//   7. Juego responsable (límite mensual, diario, auto-exclusión)
//   8. Seguridad (login, dispositivos, descargar datos)
//   9. Ayuda y soporte
//  10. Información legal
//  11. Danger zone (cerrar sesión + eliminar cuenta)
//  12. Footer "Habla! v1.0 · Hecho en Perú 🇵🇪"

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerMiPerfil } from "@/lib/services/usuarios.service";
import { obtenerPreferencias } from "@/lib/services/notificaciones.service";
import { obtenerLimites } from "@/lib/services/limites.service";
import { ProfileHero } from "@/components/perfil/ProfileHero";
import { StatsGrid } from "@/components/perfil/StatsGrid";
import { VerificacionPanel } from "@/components/perfil/VerificacionPanel";
import { DatosPersonalesPanel } from "@/components/perfil/DatosPersonalesPanel";
import { PreferenciasPanel } from "@/components/perfil/PreferenciasPanel";
import { LimitesPanel } from "@/components/perfil/LimitesPanel";
import { ProfileFooterSections } from "@/components/perfil/ProfileFooterSections";
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          Mi perfil
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Gestiona tu cuenta, verificación, notificaciones y preferencias de juego
        </p>
      </header>

      <PerfilRefreshOnUpdate />

      <ProfileHero perfil={perfil} />

      <StatsGrid perfil={perfil} />

      <nav
        aria-label="Accesos rápidos"
        className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <QuickAccess
          href="/mis-combinadas"
          icon="🎯"
          iconBg="combinadas"
          label="Mis combinadas"
        />
        <QuickAccess
          href="/wallet"
          icon="💰"
          iconBg="wallet"
          label="Billetera"
        />
        <QuickAccess
          href="/tienda"
          icon="🎁"
          iconBg="shop"
          label="Tienda de premios"
        />
        <QuickAccess href="/faq" icon="❓" iconBg="help" label="Centro de ayuda" />
      </nav>

      <VerificacionPanel perfil={perfil} onActualizar={() => {}} />
      <DatosPersonalesPanel perfil={perfil} onActualizar={() => {}} />
      <PreferenciasPanel inicial={preferencias} />
      <LimitesPanel inicial={limites} />
      <ProfileFooterSections
        balanceLukas={perfil.balanceLukas}
        email={perfil.email}
      />
    </div>
  );
}

function QuickAccess({
  href,
  icon,
  iconBg,
  label,
}: {
  href: string;
  icon: string;
  iconBg: "combinadas" | "wallet" | "shop" | "help";
  label: string;
}) {
  const iconCls =
    iconBg === "combinadas"
      ? "bg-brand-gold-dim"
      : iconBg === "wallet"
        ? "bg-alert-success-bg"
        : iconBg === "shop"
          ? "bg-[#FCE7F3]"
          : "bg-accent-champions-bg";
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-md border border-light bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md"
    >
      <span
        aria-hidden
        className={`flex h-12 w-12 items-center justify-center rounded-sm text-[22px] ${iconCls}`}
      >
        {icon}
      </span>
      <span className="text-xs font-bold leading-[1.3] text-dark">{label}</span>
    </Link>
  );
}
