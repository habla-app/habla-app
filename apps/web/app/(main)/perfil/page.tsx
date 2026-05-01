// /perfil — Lote C v3.1 (refactor del Lote 11). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// Estructura mobile-first:
//   1. ProfileHero       — avatar + badge Premium + nivel con progreso
//   2. StatsGrid         — 6 stats en 3 columnas (mobile)
//   3. PremiumStatusCard — estado Premium del usuario (oculto si N/A)
//   4. QuickAccessGrid   — 4 cards (5 si Premium)
//   5. MisCasasConectadas— casas con FTD reportado (vacío en Lote C)
//   6. VerificacionSection — email verificado
//   7. DatosSection      — nombre, @handle, etc.
//   8. NotificacionesSection — toggles + privacidad
//   9. FooterSections    — seguridad, ayuda, legal, danger zone
//
// Servicios consumidos:
//   - obtenerMiPerfil (Lote 0/11)
//   - obtenerPreferencias (Lote 1/11)
//   - obtenerMisStatsMensuales (Lote 5)
//   - obtenerEstadoPremium (Lote C, placeholder Lote E)
//   - obtenerCasasConectadas (Lote C, placeholder Lote D/E)

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  obtenerCasasConectadas,
  obtenerMiPerfil,
} from "@/lib/services/usuarios.service";
import { obtenerPreferencias } from "@/lib/services/notificaciones.service";
import { obtenerMisStatsMensuales } from "@/lib/services/leaderboard.service";
import { obtenerEstadoPremium } from "@/lib/services/suscripciones.service";
import { ProfileHero } from "@/components/perfil/ProfileHero";
import { StatsGrid } from "@/components/perfil/StatsGrid";
import { PremiumStatusCard } from "@/components/perfil/PremiumStatusCard";
import { QuickAccessGrid } from "@/components/perfil/QuickAccessGrid";
import { MisCasasConectadas } from "@/components/perfil/MisCasasConectadas";
import { VerificacionSection } from "@/components/perfil/VerificacionSection";
import { DatosSection } from "@/components/perfil/DatosSection";
import { NotificacionesSection } from "@/components/perfil/NotificacionesSection";
import { FooterSections } from "@/components/perfil/FooterSections";
import { PerfilRefreshOnUpdate } from "@/components/perfil/PerfilRefreshOnUpdate";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/perfil");

  const userId = session.user.id;

  const [perfil, preferencias, mensual, estadoPremium, casasConectadas] =
    await Promise.all([
      obtenerMiPerfil(userId),
      obtenerPreferencias(userId),
      obtenerMisStatsMensuales(userId),
      obtenerEstadoPremium(userId).catch(() => null),
      obtenerCasasConectadas(userId).catch(() => []),
    ]);

  const esPremium = estadoPremium?.activa === true;

  return (
    <div className="space-y-2 pb-16">
      <PerfilRefreshOnUpdate />

      <ProfileHero perfil={perfil} esPremium={esPremium} />
      <StatsGrid perfil={perfil} mensual={mensual} />
      <PremiumStatusCard estado={estadoPremium} />
      <QuickAccessGrid username={perfil.username} esPremium={esPremium} />
      <MisCasasConectadas casas={casasConectadas} />
      <VerificacionSection perfil={perfil} />
      <DatosSection perfil={perfil} />
      <NotificacionesSection
        inicial={preferencias}
        perfilPublicoInicial={perfil.perfilPublico}
      />
      <FooterSections email={perfil.email} />
    </div>
  );
}
