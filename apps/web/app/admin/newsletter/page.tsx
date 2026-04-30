// /admin/newsletter — Lote 10.
//
// Panel para gestionar el digest semanal:
//   - Preview del draft de la semana actual (si existe). Si no existe,
//     botón "Generar draft ahora".
//   - Editor JSON simple del `contenido` (PUT al API).
//   - Botón "Aprobar y enviar" (dorado, prominente).
//   - Histórico de digests previos (tabla con semana, destinatarios,
//     enviadoEn, aprobadoPor).
//
// El layout admin ya hace auth check (rol=ADMIN).

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  getSemanaIsoKey,
  listarDigests,
  obtenerDraftPorSemana,
} from "@/lib/services/newsletter.service";
import { NewsletterAdminPanel } from "@/components/admin/NewsletterAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const semanaActual = getSemanaIsoKey();
  const [draftActual, historico] = await Promise.all([
    obtenerDraftPorSemana(semanaActual),
    listarDigests(20),
  ]);

  return (
    <>
      <AdminPageHeader
        icon="📨"
        title="Newsletter"
        description="Generar, revisar y aprobar el digest semanal. Se envía a la unión de suscriptores confirmados + usuarios con notifSemanal=true."
      />
      <NewsletterAdminPanel
        semanaActual={semanaActual}
        draftActual={draftActual}
        historico={historico}
      />
    </>
  );
}
