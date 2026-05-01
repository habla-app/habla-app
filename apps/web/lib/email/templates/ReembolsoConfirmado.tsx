// Email 8 — Reembolso procesado en OpenPay (Lote H).
//
// Trigger: admin desde `/admin/suscripciones/[id]` (Lote F) → OpenPay
// `refund` API. También cubre reembolso automático dentro de garantía 7
// días desde `/premium/mi-suscripcion`.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaLarga, fmtSolesCentimos } from "../format";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface ReembolsoConfirmadoProps {
  nombre: string;
  montoCentimos: number;
  fechaReembolso: Date;
  numeroOperacion: string;
  motivo?: string;
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

const montoCard = {
  backgroundColor: "#F5F7FC",
  borderRadius: "12px",
  padding: "20px",
  margin: "20px 0",
  textAlign: "center" as const,
};

const montoLabel = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.7)",
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 700 as const,
  fontFamily: "'Barlow Condensed', sans-serif",
};

const montoValor = {
  fontSize: "40px",
  color: "#001050",
  margin: "0 0 8px 0",
  fontWeight: 900 as const,
  fontFamily: "'Barlow Condensed', sans-serif",
  lineHeight: "1",
};

const detalle = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.7",
  margin: "0 0 4px 0",
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function ReembolsoConfirmado({
  nombre,
  montoCentimos,
  fechaReembolso,
  numeroOperacion,
  motivo,
}: ReembolsoConfirmadoProps) {
  return (
    <Layout
      preview={`Reembolso procesado · ${fmtSolesCentimos(montoCentimos)}`}
    >
      <Heading style={heading}>↩ Reembolso procesado</Heading>
      <Text style={para}>
        {nombre}, procesamos el reembolso de tu suscripción Habla!
        Premium.
      </Text>

      <Section style={montoCard}>
        <Text style={montoLabel}>Monto reembolsado</Text>
        <Text style={montoValor}>{fmtSolesCentimos(montoCentimos)}</Text>
      </Section>

      <Text style={detalle}>
        <strong>Operación:</strong>{" "}
        <span style={{ fontFamily: "monospace" }}>{numeroOperacion}</span>
      </Text>
      <Text style={detalle}>
        <strong>Procesado el:</strong> {fmtFechaLarga(fechaReembolso)}
      </Text>
      {motivo ? (
        <Text style={detalle}>
          <strong>Motivo:</strong> {motivo}
        </Text>
      ) : null}

      <Text style={para}>
        El monto llegará a tu tarjeta en <strong>3 a 7 días hábiles</strong>
        , según los tiempos de tu banco.
      </Text>
      <Text style={para}>
        Tu acceso al Channel y al bot Premium se desactivó. Si quieres
        volver más adelante:
      </Text>

      <Button href={`${APP_URL}/premium`}>Volver a Premium</Button>

      <Text style={small}>
        Cualquier consulta, escríbenos a{" "}
        <a
          href="mailto:soporte@hablaplay.com"
          style={{ color: "#001050" }}
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

ReembolsoConfirmado.subject = "↩ Reembolso procesado · Habla! Premium";
