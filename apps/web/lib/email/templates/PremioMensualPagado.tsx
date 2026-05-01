// Email 10 — Confirmación de premio mensual pagado (Lote H).
//
// Trigger: admin click "Marcar pagado" en `/admin/premios-mensuales`
// (Lote F). Comprobante de transferencia opcional como adjunto.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaLarga, fmtSolesNumero, ordinalEs } from "../format";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface PremioMensualPagadoProps {
  username: string;
  montoSoles: number;
  posicion: number;
  mes: string; // "marzo 2026"
  bancoOrigen: string;
  bancoDestino: string;
  numeroOperacion: string;
  fechaTransferencia: Date;
}

const heading = {
  fontSize: "26px",
  margin: "0 0 12px 0",
  color: "#001050",
  fontWeight: 800 as const,
};

const para = {
  fontSize: "15px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.55",
  margin: "0 0 16px 0",
};

const tablaCard = {
  backgroundColor: "#F5F7FC",
  borderRadius: "12px",
  padding: "20px",
  margin: "20px 0",
};

const filaLabel = {
  fontSize: "12px",
  color: "rgba(0,16,80,0.7)",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  fontWeight: 700 as const,
};

const filaValor = {
  fontSize: "15px",
  color: "#001050",
  margin: "0 0 14px 0",
  fontWeight: 700 as const,
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function PremioMensualPagado({
  username,
  montoSoles,
  posicion,
  mes,
  bancoOrigen,
  bancoDestino,
  numeroOperacion,
  fechaTransferencia,
}: PremioMensualPagadoProps) {
  const ordinal = ordinalEs(posicion);
  return (
    <Layout
      preview={`Tu premio Habla! de ${fmtSolesNumero(montoSoles)} fue transferido`}
    >
      <Heading style={heading}>
        ✅ Tu premio fue transferido, @{username}
      </Heading>
      <Text style={para}>
        Te transferimos <strong>{fmtSolesNumero(montoSoles)}</strong>{" "}
        correspondiente al <strong>{ordinal} puesto</strong> de Liga
        Habla! en {mes}.
      </Text>

      <Section style={tablaCard}>
        <Text style={filaLabel}>Monto transferido</Text>
        <Text
          style={{
            ...filaValor,
            fontSize: "24px",
            color: "#001050",
            fontWeight: 900,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          {fmtSolesNumero(montoSoles)}
        </Text>

        <Text style={filaLabel}>Banco origen</Text>
        <Text style={filaValor}>{bancoOrigen}</Text>

        <Text style={filaLabel}>Banco destino</Text>
        <Text style={filaValor}>{bancoDestino}</Text>

        <Text style={filaLabel}>Operación</Text>
        <Text style={{ ...filaValor, fontFamily: "monospace", fontSize: "13px" }}>
          {numeroOperacion}
        </Text>

        <Text style={filaLabel}>Fecha de la transferencia</Text>
        <Text style={{ ...filaValor, marginBottom: 0 }}>
          {fmtFechaLarga(fechaTransferencia)}
        </Text>
      </Section>

      <Text style={para}>
        El abono debería verse reflejado en tu cuenta en{" "}
        <strong>1 a 24 horas</strong>, según los tiempos del banco.
      </Text>

      <Button href={`${APP_URL}/comunidad`}>Sigue compitiendo</Button>

      <Text style={small}>
        Si no ves el monto en 48 horas, escríbenos a{" "}
        <a
          href="mailto:soporte@hablaplay.com"
          style={{ color: "#001050" }}
        >
          soporte@hablaplay.com
        </a>{" "}
        con esta operación.
      </Text>
    </Layout>
  );
}

PremioMensualPagado.subject =
  "✅ Tu premio Habla! fue transferido";
