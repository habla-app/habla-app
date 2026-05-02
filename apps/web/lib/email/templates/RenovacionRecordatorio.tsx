// Email 6 — Recordatorio de renovación próxima (Lote H).
//
// Trigger: cron diario que busca suscripciones con `proximoCobro` en
// exactamente 7 días. Tono amigable, sin alarmar — la suscripción se
// renueva automáticamente, sólo informamos.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaCorta, fmtSolesCentimos } from "../format";
import { PLAN_LABELS, type PlanPremium } from "../types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface RenovacionRecordatorioProps {
  nombre: string;
  plan: PlanPremium;
  proximoCobro: Date;
  montoCentimos: number;
}

const heading = {
  fontSize: "24px",
  margin: "0 0 12px 0",
  color: "#001050",
  fontWeight: 800 as const,
};

const para = {
  fontSize: "15px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.55",
  margin: "0 0 12px 0",
};

const detallesCard = {
  backgroundColor: "#FFF8E1",
  border: "1.5px solid #FFB800",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "20px 0",
};

const detalleLabel = {
  fontSize: "12px",
  color: "rgba(0,16,80,0.7)",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 700 as const,
};

const detalleValor = {
  fontSize: "16px",
  color: "#001050",
  margin: "0 0 12px 0",
  fontWeight: 700 as const,
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function RenovacionRecordatorio({
  nombre,
  plan,
  proximoCobro,
  montoCentimos,
}: RenovacionRecordatorioProps) {
  const planLabel = PLAN_LABELS[plan];
  return (
    <Layout
      preview={`Tu Premium se renueva el ${fmtFechaCorta(proximoCobro)}`}
    >
      <Heading style={heading}>
        Tu Habla! Premium se renueva en 7 días
      </Heading>
      <Text style={para}>
        {nombre}, te avisamos con tiempo: el próximo cobro de tu
        suscripción <strong>Plan {planLabel}</strong> está programado para
        la próxima semana.
      </Text>

      <Section style={detallesCard}>
        <Text style={detalleLabel}>Próximo cobro</Text>
        <Text style={detalleValor}>{fmtFechaCorta(proximoCobro)}</Text>

        <Text style={detalleLabel}>Monto a cobrar</Text>
        <Text style={{ ...detalleValor, marginBottom: 0 }}>
          {fmtSolesCentimos(montoCentimos)}
        </Text>
      </Section>

      <Text style={para}>
        <strong>Si quieres seguir recibiendo picks:</strong> no necesitas
        hacer nada. Cobramos automáticamente.
      </Text>
      <Text style={para}>
        <strong>Si quieres cancelar:</strong> hazlo ahora desde tu panel y
        no te cobramos. Mantienes acceso hasta la fecha de vencimiento.
      </Text>

      <Button href={`${APP_URL}/premium/mi-suscripcion`}>
        Ver mi suscripción
      </Button>

      <Text style={small}>
        ¿Tu tarjeta cambió? Actualízala antes del cobro para evitar
        interrupciones.
      </Text>
      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

RenovacionRecordatorio.subject =
  "🔔 Tu Habla! Premium se renueva en 7 días";
