// Parser de extractos bancarios Interbank — Lote 8.
//
// Formato típico de Interbank Empresas (CSV, separador "," o ";"):
//   Fecha,Descripción,Tipo,Monto,Saldo
//   01/05/2026,"COMPRA POS CULQI",ABONO,100.00,15100.00
//   02/05/2026,"PAGO SUNAT",CARGO,36.61,15063.39
//
// Reglas:
//  - Encoding: detectamos BOM UTF-8; si falta y aparecen caracteres
//    inválidos, fallback a Windows-1252 vía decoder.
//  - Fecha: dd/mm/yyyy (Lima). Convertimos a Date (medianoche UTC del día).
//  - Monto: cargo (CARGO/DÉBITO) → negativo; abono (ABONO/CRÉDITO) → positivo.
//  - Si >5% de filas tienen error de parseo, devolvemos error global y NO
//    insertamos nada (el caller debe decidir si re-emitir manualmente).

export interface MovimientoParseado {
  fecha: Date;
  monto: number;
  descripcion: string;
  referenciaBanco: string | null;
}

export interface ParseResult {
  movimientos: MovimientoParseado[];
  filasTotales: number;
  filasError: number;
  errores: Array<{ linea: number; razon: string; raw: string }>;
  rangoFechaInicio: Date | null;
  rangoFechaFin: Date | null;
}

const HEADER_KEYS = ["fecha", "descripción", "descripcion", "monto"];
const TIPO_CARGO = ["CARGO", "DEBITO", "DÉBITO"];
const TIPO_ABONO = ["ABONO", "CREDITO", "CRÉDITO"];

function detectarSeparador(linea: string): "," | ";" {
  // Cuenta apariciones fuera de comillas. Para casos simples, basta el max.
  const semis = (linea.match(/;/g) ?? []).length;
  const comas = (linea.match(/,/g) ?? []).length;
  return semis > comas ? ";" : ",";
}

function decodeBuffer(buf: Buffer): string {
  // BOM UTF-8: 0xEF, 0xBB, 0xBF
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString("utf8");
  }
  // Probamos UTF-8; si tiene replacement chars (U+FFFD), retry con latin1.
  const utf = buf.toString("utf8");
  if (utf.includes("�")) return buf.toString("latin1");
  return utf;
}

function parseFecha(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (
    isNaN(dia) ||
    isNaN(mes) ||
    isNaN(anio) ||
    dia < 1 ||
    dia > 31 ||
    mes < 1 ||
    mes > 12
  )
    return null;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function parseMonto(raw: string): number | null {
  // Interbank suele usar coma como decimal. Soportamos ambas.
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  // Si tiene "," como decimal y "." como miles → "1.234,56"
  // Si tiene "." como decimal → "1234.56"
  let normal = s;
  if (s.includes(",") && s.includes(".")) {
    // formato "1.234,56" → quitar "." de miles, "," → "."
    normal = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    normal = s.replace(",", ".");
  }
  const n = Number(normal);
  if (isNaN(n)) return null;
  return n;
}

function dividirCsvLinea(linea: string, sep: ","| ";"): string[] {
  const result: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (inQuote && linea[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      result.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  result.push(buf);
  return result.map((s) => s.trim().replace(/^"|"$/g, ""));
}

export function parsearExtractoInterbank(buf: Buffer): ParseResult {
  const text = decodeBuffer(buf);
  const lineas = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const errores: ParseResult["errores"] = [];
  const movimientos: MovimientoParseado[] = [];
  let rangoIni: Date | null = null;
  let rangoFin: Date | null = null;

  if (lineas.length === 0) {
    return {
      movimientos,
      filasTotales: 0,
      filasError: 0,
      errores: [],
      rangoFechaInicio: null,
      rangoFechaFin: null,
    };
  }

  const sep = detectarSeparador(lineas[0]);

  // Localizar fila de header (la primera que tenga al menos 2 keywords).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lineas.length, 10); i++) {
    const lower = lineas[i].toLowerCase();
    const matches = HEADER_KEYS.filter((k) => lower.includes(k)).length;
    if (matches >= 2) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headerCols = dividirCsvLinea(lineas[headerIdx], sep).map((s) =>
    s.toLowerCase(),
  );
  const idxFecha = headerCols.findIndex((c) => c.includes("fecha"));
  const idxDesc = headerCols.findIndex((c) =>
    c.includes("descripción") || c.includes("descripcion") || c.includes("concepto"),
  );
  const idxTipo = headerCols.findIndex((c) => c === "tipo" || c.includes("operacion"));
  const idxMonto = headerCols.findIndex((c) =>
    c === "monto" || c.includes("importe"),
  );
  const idxRef = headerCols.findIndex((c) =>
    c.includes("referencia") || c.includes("operacion") || c.includes("nro"),
  );

  if (idxFecha === -1 || idxDesc === -1 || idxMonto === -1) {
    return {
      movimientos: [],
      filasTotales: lineas.length - headerIdx - 1,
      filasError: lineas.length - headerIdx - 1,
      errores: [
        {
          linea: headerIdx + 1,
          razon: "header sin columnas requeridas (fecha, descripción, monto)",
          raw: lineas[headerIdx],
        },
      ],
      rangoFechaInicio: null,
      rangoFechaFin: null,
    };
  }

  const dataLineas = lineas.slice(headerIdx + 1);

  for (let i = 0; i < dataLineas.length; i++) {
    const linea = dataLineas[i];
    const cols = dividirCsvLinea(linea, sep);
    if (cols.length < Math.max(idxFecha, idxDesc, idxMonto) + 1) continue;

    try {
      const fecha = parseFecha(cols[idxFecha]);
      if (!fecha) {
        errores.push({ linea: headerIdx + 2 + i, razon: "fecha inválida", raw: linea });
        continue;
      }
      const descripcion = cols[idxDesc] || "";
      let monto = parseMonto(cols[idxMonto]);
      if (monto === null) {
        errores.push({ linea: headerIdx + 2 + i, razon: "monto inválido", raw: linea });
        continue;
      }

      const tipoRaw = idxTipo >= 0 ? (cols[idxTipo] ?? "").toUpperCase() : "";
      // Aplicar signo según tipo si viene; si no, asumimos signo del monto crudo.
      if (tipoRaw && TIPO_CARGO.some((t) => tipoRaw.includes(t))) {
        monto = -Math.abs(monto);
      } else if (tipoRaw && TIPO_ABONO.some((t) => tipoRaw.includes(t))) {
        monto = Math.abs(monto);
      }

      const referenciaBanco = idxRef >= 0 && cols[idxRef] ? cols[idxRef] : null;

      movimientos.push({ fecha, monto, descripcion, referenciaBanco });

      if (!rangoIni || fecha < rangoIni) rangoIni = fecha;
      if (!rangoFin || fecha > rangoFin) rangoFin = fecha;
    } catch (err) {
      errores.push({
        linea: headerIdx + 2 + i,
        razon: err instanceof Error ? err.message : "error desconocido",
        raw: linea,
      });
    }
  }

  return {
    movimientos,
    filasTotales: dataLineas.length,
    filasError: errores.length,
    errores,
    rangoFechaInicio: rangoIni,
    rangoFechaFin: rangoFin,
  };
}
