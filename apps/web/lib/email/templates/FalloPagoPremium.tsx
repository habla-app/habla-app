// Email 7 — Pago rechazado >3 intentos consecutivos (Lote H).
//
// Trigger: webhook OpenPay reporta `charge.failed` 3 veces → cron
// `procesarPagosFallidos` (Lote E sync-membresia) marca como
// `MOROSO`/pausado. Tono empático: el problema es la tarjeta del banco,
// no del usuario.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface FalloPagoPremiumProps {
  nombre: string;
  motivo: string; // ej: "Fondos insuficientes", "Tarjeta expirada"
  linkActualizarTarjeta?: string;
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

const motivoCard = {
  backgroundColor: "#FEF2F2",
  borderLeft: "4px solid #DC2626",
  padding: "14px 16px",
  borderRadius: "8px",
  margin: "16px 0",
};

const motivoText = {
  fontSize: "14px",
  color: "rgba(0,16,80,0.85)",
  margin: 0,
  lineHeight: "1.5",
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function FalloPagoPremium({
  nombre,
  motivo,
  linkActualizarTarjeta,
}: FalloPagoPremiumProps) {
  const link =
    linkActualizarTarjeta ?? `${APP_URL}/premium/mi-suscripcion`;
  return (
    <Layout preview="No pudimos procesar tu pago de Habla! Premium">
      <Heading style={heading}>⚠ No pudimos procesar tu pago</Heading>
      <Text style={para}>
        {nombre}, tras <strong>3 intentos</strong> consecutivos no
        pudimos cobrar tu suscripción a Habla! Premium. Tu acceso al
        Channel se pausó temporalmente.
      </Text>

      <Section style={motivoCard}>
        <Text style={motivoText}>
          <strong>Motivo:</strong> {motivo}
        </Text>
      </Section>

      <Text style={para}>
        <strong>Para reactivar:</strong>
      </Text>
      <Text style={para}>1. Verifica que tu tarjeta tenga fondos.</Text>
      <Text style={para}>2. Confirma que no esté vencida.</Text>
      <Text style={para}>3. O usa otra tarjeta desde tu panel.</Text>

      <Button href={link}>Actualizar tarjeta</Button>

      <Text style={para}>
        Si necesitas ayuda, escríbenos a{" "}
        <a
          href="mailto:soporte@hablaplay.com"
          style={{ color: "#001050", fontWeight: 700 }}
        >
          soporte@hablaplay.com
        </a>
        .
      </Text>

      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

FalloPagoPremium.subject = "⚠ No pudimos procesar tu pago Premium";
