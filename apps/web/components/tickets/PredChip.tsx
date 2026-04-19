// PredChip — chip de predicción coloreado por estado. Replica
// `.pred-chip` del mockup. Estados:
//   - "correct" (verde): la predicción se cumplió
//   - "wrong" (rojo): la predicción falló
//   - "pending" (gris): sigue sin resolverse

import type { ReactNode } from "react";

type Estado = "correct" | "wrong" | "pending";

interface PredChipProps {
  estado: Estado;
  children: ReactNode;
}

const CLASSES: Record<Estado, string> = {
  correct: "bg-pred-correct-bg text-[#065F46] border-pred-correct/30",
  wrong: "bg-pred-wrong-bg text-[#9F2020] border-pred-wrong/30",
  pending:
    "bg-pred-pending-bg text-muted-d border-pred-pending/20",
};

const PREFIX: Record<Estado, string> = {
  correct: "✓ ",
  wrong: "✗ ",
  pending: "",
};

export function PredChip({ estado, children }: PredChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${CLASSES[estado]}`}
    >
      <span aria-hidden>{PREFIX[estado]}</span>
      {children}
    </span>
  );
}
