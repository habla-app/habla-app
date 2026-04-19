"use client";
// ScorePicker mini — picker numérico ± para el marcador exacto.
// Replica `.score-picker-mini` del mockup. Rango 0-9 por equipo.

interface ScorePickerProps {
  nombreLocal: string;
  nombreVisita: string;
  golesLocal: number;
  golesVisita: number;
  onChange: (local: number, visita: number) => void;
}

const MIN = 0;
const MAX = 9;

export function ScorePicker({
  nombreLocal,
  nombreVisita,
  golesLocal,
  golesVisita,
  onChange,
}: ScorePickerProps) {
  const update = (side: "local" | "visita", delta: number) => {
    if (side === "local") {
      const next = Math.max(MIN, Math.min(MAX, golesLocal + delta));
      onChange(next, golesVisita);
    } else {
      const next = Math.max(MIN, Math.min(MAX, golesVisita + delta));
      onChange(golesLocal, next);
    }
  };

  return (
    <div className="flex items-center justify-center gap-5 py-1.5">
      <ScoreSide
        name={nombreLocal}
        value={golesLocal}
        onDec={() => update("local", -1)}
        onInc={() => update("local", +1)}
      />
      <div className="font-display text-[18px] font-extrabold text-soft">
        —
      </div>
      <ScoreSide
        name={nombreVisita}
        value={golesVisita}
        onDec={() => update("visita", -1)}
        onInc={() => update("visita", +1)}
      />
    </div>
  );
}

function ScoreSide({
  name,
  value,
  onDec,
  onInc,
}: {
  name: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-d">
        {name}
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={`Restar gol a ${name}`}
          onClick={onDec}
          className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-strong bg-card text-[17px] font-bold text-dark transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
        >
          −
        </button>
        <div className="min-w-[28px] text-center font-display text-[34px] font-black leading-none text-brand-gold-dark">
          {value}
        </div>
        <button
          type="button"
          aria-label={`Sumar gol a ${name}`}
          onClick={onInc}
          className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-strong bg-card text-[17px] font-bold text-dark transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
        >
          +
        </button>
      </div>
    </div>
  );
}
