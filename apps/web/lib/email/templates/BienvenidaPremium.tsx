// Email 4 — Bienvenida tras activar Habla! Premium (Lote H).
//
// Trigger: webhook OpenPay → `activarSuscripcion()` (ver Lote E
// `suscripciones.service.ts`). Crítico: este email debe llegar SI O SÍ
// porque incluye el link al WhatsApp Channel privado.

import { Heading, Hr, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaCorta } from "../format";
import { PLAN_LABELS, type PlanPremium } from "../types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface BienvenidaPremiumProps {
  nombre: string;
  plan: PlanPremium;
  proximoCobro: Date;
  channelLink: string | null;
  email: string;
}

const heading = {
  fontSize: "28px",
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

const channelCard = {
  backgroundColor: "#0a0e25",
  color: "#FFFFFF",
  padding: "24px",
  borderRadius: "12px",
  textAlign: "center" as const,
  margin: "24px 0",
};

const channelTitle = {
  color: "#FFFFFF",
  fontWeight: 800 as const,
  fontSize: "18px",
  margin: "0 0 8px 0",
};

const channelSub = {
  color: "rgba(255,255,255,0.8)",
  fontSize: "14px",
  margin: "0 0 16px 0",
};

const inclusionesH = {
  fontWeight: 700 as const,
  fontSize: "15px",
  color: "#001050",
  margin: "24px 0 8px 0",
};

const inclusion = {
  fontSize: "14px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.7",
  margin: "0 0 4px 0",
};

const detallesCard = {
  backgroundColor: "#F5F7FC",
  borderRadius: "10px",
  padding: "16px",
  margin: "16px 0",
};

const detalle = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.7",
  margin: "0 0 4px 0",
};

const hr = {
  border: "none",
  borderTop: "1px solid #E5E7EB",
  margin: "24px 0",
};

const aviso = {
  fontSize: "12px",
  color: "#6B7280",
  textAlign: "center" as const,
  marginTop: "16px",
};

export function BienvenidaPremium({
  nombre,
  plan,
  proximoCobro,
  channelLink,
  email,
}: BienvenidaPremiumProps) {
  const planLabel = PLAN_LABELS[plan];
  return (
    <Layout
      preview={`Bienvenido a Habla! Premium · Plan ${planLabel} activo`}
    >
      <Heading style={heading}>
        🎉 ¡Bienvenido a Premium, {nombre}!
      </Heading>
      <Text style={para}>
        Tu suscripción <strong>Plan {planLabel}</strong> está{" "}
        <strong>activa</strong>.
      </Text>

      <Section style={channelCard}>
        <Text style={channelTitle}>
          📱 Próximo paso: únete al WhatsApp Channel
        </Text>
        <Text style={channelSub}>
          Es donde recibirás los picks. Solo 1 click.
        </Text>
        {channelLink ? (
          <Button href={channelLink} variant="whatsapp">
            Unirme al Channel
          </Button>
        ) : (
          <Text style={{ ...channelSub, fontWeight: 700 }}>
            Te enviaremos el link en las próximas 24 horas.
          </Text>
        )}
      </Section>

      <Text style={inclusionesH}>Lo que recibes:</Text>
      <Text style={inclusion}>
        ✓ 2-4 picks/día con razonamiento estadístico (datos H2H, forma,
        EV+)
      </Text>
      <Text style={inclusion}>
        ✓ Casa con mejor cuota en cada pick
      </Text>
      <Text style={inclusion}>
        ✓ Alertas en vivo durante partidos top
      </Text>
      <Text style={inclusion}>✓ Bot FAQ 24/7 en WhatsApp 1:1</Text>
      <Text style={inclusion}>✓ Resumen semanal los lunes</Text>

      <Hr style={hr} />

      <Section style={detallesCard}>
        <Text style={detalle}>
          Próximo cobro: <strong>{fmtFechaCorta(proximoCobro)}</strong>
        </Text>
        <Text style={detalle}>
          Plan: <strong>{planLabel}</strong>
        </Text>
        <Text style={detalle}>
          Email: <strong>{email}</strong>
        </Text>
        <Text style={detalle}>
          Garantía: <strong>7 días sin compromiso</strong>
        </Text>
      </Section>

      <Text style={para}>
        Para gestionar tu suscripción:{" "}
        <a
          href={`${APP_URL}/premium/mi-suscripcion`}
          style={{ color: "#001050", fontWeight: 700 }}
        >
          Mi suscripción
        </a>
        .
      </Text>

      <Text style={aviso}>
        Apuesta responsable. Línea Tugar (gratuita): 0800-19009.
      </Text>
    </Layout>
  );
}

BienvenidaPremium.subject = "🎉 Bienvenido a Habla! Premium";
