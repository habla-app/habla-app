// Email 5 — Factura tras un pago Premium acreditado (Lote H).
//
// Trigger: cada pago acreditado (primer pago + cada renovación). Webhook
// OpenPay → `procesarPagoSuscripcion()` (Lote E). El PDF de factura
// electrónica se adjunta opcionalmente vía `sendEmail({ attachments })`.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaCorta, fmtSolesCentimos } from "../format";
import { PLAN_LABELS, type PlanPremium } from "../types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface FacturaPremiumProps {
  nombre: string;
  numeroOperacion: string;
  montoCentimos: number;
  plan: PlanPremium;
  fechaPago: Date;
  metodoPago: string; // ej: "Visa ****1234"
  proximoCobro: Date;
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

const tablaCard = {
  backgroundColor: "#F5F7FC",
  borderRadius: "12px",
  padding: "20px",
  margin: "20px 0",
};

const filaLabel = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.7)",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 700 as const,
};

const filaValor = {
  fontSize: "16px",
  color: "#001050",
  margin: "0 0 16px 0",
  fontWeight: 700 as const,
};

const total = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.7)",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 700 as const,
};

const totalValor = {
  fontSize: "32px",
  color: "#001050",
  margin: "0 0 12px 0",
  fontWeight: 900 as const,
  fontFamily: "'Barlow Condensed', sans-serif",
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function FacturaPremium({
  nombre,
  numeroOperacion,
  montoCentimos,
  plan,
  fechaPago,
  metodoPago,
  proximoCobro,
}: FacturaPremiumProps) {
  const planLabel = PLAN_LABELS[plan];
  return (
    <Layout
      preview={`Factura Habla! Premium · ${fmtSolesCentimos(montoCentimos)}`}
    >
      <Heading style={heading}>✅ Cobro confirmado</Heading>
      <Text style={para}>
        {nombre}, confirmamos el cobro de tu suscripción{" "}
        <strong>Habla! Premium {planLabel}</strong>.
      </Text>

      <Section style={tablaCard}>
        <Text style={total}>Monto cobrado</Text>
        <Text style={totalValor}>{fmtSolesCentimos(montoCentimos)}</Text>

        <Text style={filaLabel}>Plan</Text>
        <Text style={filaValor}>{planLabel}</Text>

        <Text style={filaLabel}>Método de pago</Text>
        <Text style={filaValor}>{metodoPago}</Text>

        <Text style={filaLabel}>Fecha del cobro</Text>
        <Text style={filaValor}>{fmtFechaCorta(fechaPago)}</Text>

        <Text style={filaLabel}>Operación</Text>
        <Text style={{ ...filaValor, fontFamily: "monospace", fontSize: "14px" }}>
          {numeroOperacion}
        </Text>

        <Text style={filaLabel}>Próximo cobro</Text>
        <Text style={{ ...filaValor, marginBottom: 0 }}>
          {fmtFechaCorta(proximoCobro)}
        </Text>
      </Section>

      <Button href={`${APP_URL}/premium/mi-suscripcion`}>
        Ver mi suscripción
      </Button>

      <Text style={small}>
        Si no reconoces este cobro, escríbenos a{" "}
        <a
          href="mailto:soporte@hablaplay.com"
          style={{ color: "#001050" }}
        >
          soporte@hablaplay.com
        </a>{" "}
        en menos de 7 días.
      </Text>
      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

FacturaPremium.subject = "✅ Pago confirmado · Habla! Premium";
