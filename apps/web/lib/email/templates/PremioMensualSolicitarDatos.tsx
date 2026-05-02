// Email 9 — Solicitar datos bancarios al ganador del mes (Lote H).
//
// Trigger: admin click "Solicitar datos" en `/admin/premios-mensuales`
// (Lote F). El ganador responde con Yape/Plin/banco para que el admin
// haga la transferencia manual.

import { Heading, Section, Text } from "@react-email/components";
import { Layout } from "./_components";
import { fmtSolesNumero, ordinalEs } from "../format";

export interface PremioMensualSolicitarDatosProps {
  username: string;
  posicion: number;
  puntos: number;
  montoSoles: number;
  mes: string; // ej: "marzo 2026"
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

const premioCard = {
  background: "linear-gradient(135deg, #FFF8E1, #FFFDF5)",
  border: "1.5px solid #FFB800",
  borderRadius: "14px",
  padding: "20px",
  textAlign: "center" as const,
  margin: "20px 0",
};

const premioLabel = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "14px",
  fontWeight: 800 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#8B6200",
  margin: 0,
};

const premioValor = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "48px",
  fontWeight: 900 as const,
  color: "#001050",
  lineHeight: "1",
  margin: "8px 0",
};

const premioFooter = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.7)",
  margin: 0,
};

const subH = {
  fontSize: "18px",
  color: "#001050",
  fontWeight: 700 as const,
  margin: "24px 0 8px 0",
};

const item = {
  fontSize: "14px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.7",
  margin: "0 0 4px 0",
};

const aviso = {
  backgroundColor: "#F5F7FC",
  borderLeft: "4px solid #0052CC",
  padding: "14px 16px",
  borderRadius: "8px",
  margin: "16px 0",
};

const avisoText = {
  fontSize: "13px",
  color: "rgba(0,16,80,0.85)",
  lineHeight: "1.5",
  margin: 0,
};

const small = {
  fontSize: "12px",
  color: "#6B7280",
  marginTop: "16px",
};

export function PremioMensualSolicitarDatos({
  username,
  posicion,
  puntos,
  montoSoles,
  mes,
}: PremioMensualSolicitarDatosProps) {
  const ordinal = ordinalEs(posicion);
  return (
    <Layout
      preview={`Quedaste #${posicion} en ${mes} · ${fmtSolesNumero(montoSoles)}`}
    >
      <Heading style={heading}>
        🏆 ¡Felicidades, @{username}!
      </Heading>
      <Text style={para}>
        Quedaste en el <strong>{ordinal} puesto</strong> del leaderboard
        de Liga Habla! del mes de <strong>{mes}</strong> con{" "}
        <strong>{puntos} pts</strong>.
      </Text>

      <Section style={premioCard}>
        <Text style={premioLabel}>Has ganado</Text>
        <Text style={premioValor}>{fmtSolesNumero(montoSoles)}</Text>
        <Text style={premioFooter}>en efectivo</Text>
      </Section>

      <Text style={subH}>
        Para coordinar tu pago, responde este email con:
      </Text>
      <Text style={item}>• Tu <strong>nombre completo</strong></Text>
      <Text style={item}>• Tu <strong>DNI</strong></Text>
      <Text style={item}>
        • Método preferido:{" "}
        <strong>Yape · Plin · transferencia bancaria</strong>
      </Text>
      <Text style={item}>
        • Número de celular (Yape/Plin) o cuenta + banco (transferencia)
      </Text>

      <Section style={aviso}>
        <Text style={avisoText}>
          Te confirmamos el pago en{" "}
          <strong>máximo 3 días hábiles</strong> tras recibir tus datos.
        </Text>
      </Section>

      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

PremioMensualSolicitarDatos.subject =
  "🏆 ¡Felicidades! Coordina tu premio Habla!";
