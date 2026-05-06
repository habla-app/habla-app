// Celda "Cuotas" para la tabla /admin/partidos (Lote V.14).
//
// Server component que muestra el estado de captura por partido:
//   - "✓ 5/5 · hace 4m" (completas, verde)
//   - "⚠ 3/5 · hace 12m" (parciales, ámbar)
//   - "✗ 0/5" (sin datos, rojo)
//   - "—" (no aplica · partido sin Filtro 1 aún)
// Y un botón ↻ para refrescar (cliente).

import { CuotasRefreshBtn } from "./CuotasRefreshBtn";
import type { CuotasResumen } from "@/lib/services/admin-partidos.service";

interface Props {
  partidoId: string;
  cuotas: CuotasResumen;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ahora = Date.now();
  const t = new Date(iso).getTime();
  const segs = Math.max(0, Math.floor((ahora - t) / 1000));
  if (segs < 60) return `hace ${segs}s`;
  const mins = Math.floor(segs / 60);
  if (mins < 60) return `hace ${mins}m`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
}

export function CuotasCelda({ partidoId, cuotas }: Props) {
  const { casasCompletas, casasConDatos, casasTotales, ultimaActualizacion } =
    cuotas;

  let pillClass = "adm-pill adm-pill-gray";
  let icono = "—";
  let texto = `0/${casasTotales}`;
  if (casasCompletas === casasTotales) {
    pillClass = "adm-pill adm-pill-green";
    icono = "✓";
    texto = `${casasCompletas}/${casasTotales}`;
  } else if (casasCompletas > 0 || casasConDatos > 0) {
    pillClass = "adm-pill adm-pill-amber";
    icono = "⚠";
    // Mostrar completas/totales, con sub-info de parciales si hay
    if (casasConDatos > casasCompletas) {
      texto = `${casasCompletas}/${casasTotales} (+${casasConDatos - casasCompletas} parc.)`;
    } else {
      texto = `${casasCompletas}/${casasTotales}`;
    }
  } else if (cuotas.estado === "INACTIVA") {
    icono = "—";
    texto = "—";
  } else {
    pillClass = "adm-pill adm-pill-red";
    icono = "✗";
    texto = `0/${casasTotales}`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span className={pillClass} style={{ fontSize: 11, whiteSpace: "nowrap" }}>
          {icono} {texto}
        </span>
        <span style={{ fontSize: 9, color: "rgba(0,16,80,.42)", marginTop: 2 }}>
          {formatRelative(ultimaActualizacion)}
        </span>
      </div>
      <CuotasRefreshBtn scope="partido" partidoId={partidoId} compact />
    </div>
  );
}
