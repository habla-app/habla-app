// PartidoPospuesto — Lote L v3.2 (May 2026).
//
// Trigger: cron de importación detecta cambio de `fechaInicio` sobre un
// partido con tickets activos (decisión §4.9.3 del análisis-repo-vs-mockup-v3.2).
// El usuario recibe un aviso para revisar su combinada — sigue activa pero
// el horario cambió, lo que puede afectar predicciones (ej. clima, motivación).

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";
import { fmtFechaCorta } from "../format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface PartidoPospuestoProps {
  username: string;
  partidoNombre: string;
  ligaNombre: string;
  fechaAnterior: Date;
  fechaNueva: Date;
  partidoSlug: string | null;
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

const fechaCard = {
  backgroundColor: "#F5F7FC",
  borderRadius: "10px",
  padding: "16px",
  margin: "16px 0",
};

const fechaLabel = {
  fontSize: "12px",
  fontWeight: 700 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "rgba(0,16,80,0.6)",
  margin: "0 0 4px 0",
};

const fechaValor = {
  fontSize: "16px",
  fontWeight: 700 as const,
  color: "#001050",
  margin: "0 0 12px 0",
};

const aviso = {
  backgroundColor: "#FFF8E1",
  borderLeft: "4px solid #FFB800",
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

export function PartidoPospuesto({
  username,
  partidoNombre,
  ligaNombre,
  fechaAnterior,
  fechaNueva,
  partidoSlug,
}: PartidoPospuestoProps) {
  const link = partidoSlug
    ? `${APP_URL}/liga/${partidoSlug}`
    : `${APP_URL}/liga`;
  return (
    <Layout
      preview={`${partidoNombre} cambió de horario · tu combinada sigue activa`}
    >
      <Heading style={heading}>El partido cambió de horario</Heading>
      <Text style={para}>
        Hola @{username}, te avisamos que el partido{" "}
        <strong>{partidoNombre}</strong> ({ligaNombre}) fue reprogramado.
      </Text>

      <Section style={fechaCard}>
        <Text style={fechaLabel}>Antes</Text>
        <Text style={fechaValor}>{fmtFechaCorta(fechaAnterior)}</Text>
        <Text style={fechaLabel}>Ahora</Text>
        <Text style={fechaValor}>{fmtFechaCorta(fechaNueva)}</Text>
      </Section>

      <Text style={para}>
        <strong>Tu combinada sigue activa.</strong> Como el horario cambió, vas
        a poder editarla nuevamente hasta el nuevo kickoff. Si querés ajustar
        tus predicciones (por clima, motivación o lesiones que pudieran haber
        cambiado), entrá al partido desde tu Liga.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
        <Button href={link}>Revisar mi combinada</Button>
      </Section>

      <Section style={aviso}>
        <Text style={avisoText}>
          Si no querés cambiar nada, no hace falta hacer nada — tu combinada
          actual queda como está y se evalúa con el nuevo horario.
        </Text>
      </Section>

      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

PartidoPospuesto.subject = "⏰ El partido cambió de horario";
