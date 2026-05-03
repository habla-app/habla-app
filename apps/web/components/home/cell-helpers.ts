// Helpers compartidos por las celdas de la tabla "Encuentra las fijas"
// del Home (Lote N v3.2).
//
// `fechaHora` produce la string del mockup "Hoy 09:00", "Mañana 11:00" o
// "5 may 14:00" según el día Lima.

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function partesLima(fecha: Date): { y: number; m: number; d: number; hh: string; mm: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = fmt.formatToParts(fecha);
  const get = (t: string): string => partes.find((p) => p.type === t)?.value ?? "";
  return {
    y: parseInt(get("year"), 10),
    m: parseInt(get("month"), 10),
    d: parseInt(get("day"), 10),
    hh: get("hour"),
    mm: get("minute"),
  };
}

export function fechaHora(fecha: Date, ahora: Date = new Date()): string {
  const f = partesLima(fecha);
  const a = partesLima(ahora);
  const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const m = partesLima(manana);

  const hora = `${f.hh}:${f.mm}`;

  if (f.y === a.y && f.m === a.m && f.d === a.d) {
    return `Hoy ${hora}`;
  }
  if (f.y === m.y && f.m === m.m && f.d === m.d) {
    return `Mañana ${hora}`;
  }
  return `${f.d} ${MESES_CORTOS[f.m - 1] ?? ""} ${hora}`;
}
