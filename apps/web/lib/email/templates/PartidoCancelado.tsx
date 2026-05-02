// PartidoCancelado — Lote L v3.2 (May 2026).
//
// Trigger: cron de importación detecta que un partido pasó a estado
// CANCELADO en api-football (decisión §4.9.4 del análisis-repo-vs-mockup-v3.2).
// El usuario recibe un aviso: cero puntos para todos en ese partido (no
// negativo, no positivo), su combinada queda sin efecto para el ranking.

import { Heading, Section, Text } from "@react-email/components";
import { Button, Layout } from "./_components";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";

export interface PartidoCanceladoProps {
  username: string;
  partidoNombre: string;
  ligaNombre: string;
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

export function PartidoCancelado({
  username,
  partidoNombre,
  ligaNombre,
}: PartidoCanceladoProps) {
  return (
    <Layout
      preview={`${partidoNombre} fue cancelado · tu combinada queda sin efecto`}
    >
      <Heading style={heading}>El partido fue cancelado</Heading>
      <Text style={para}>
        Hola @{username}, te avisamos que el partido{" "}
        <strong>{partidoNombre}</strong> ({ligaNombre}) fue cancelado.
      </Text>

      <Text style={para}>
        Tus predicciones para ese partido <strong>quedan sin efecto</strong>{" "}
        para el ranking del mes — no suman ni restan puntos. La combinada
        queda registrada en tu historial pero no se evalúa.
      </Text>

      <Section style={aviso}>
        <Text style={avisoText}>
          Tu posición en el leaderboard del mes no se ve afectada por esta
          cancelación. Podés seguir compitiendo en otros partidos elegibles de
          la Liga Habla!.
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
        <Button href={`${APP_URL}/liga`}>Ver la Liga Habla!</Button>
      </Section>

      <Text style={small}>
        Apuesta responsable. Línea Tugar: 0800-19009.
      </Text>
    </Layout>
  );
}

PartidoCancelado.subject = "📢 El partido fue cancelado";
