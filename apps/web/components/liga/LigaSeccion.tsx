// LigaSeccion — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-liga-list .liga-section.
//
// Wrapper de las 3 secciones (próximos / en vivo / terminados). Renderiza
// header + tabla densa desktop + cards mobile usando PartidoLigaRow.

import {
  PartidoLigaCardMobile,
  PartidoLigaRowDesktop,
} from "./PartidoLigaRow";
import type { PartidoLigaItem } from "@/lib/services/liga.service";

interface Props {
  titulo: string;
  subtitulo?: string;
  partidos: PartidoLigaItem[];
  variante: "proximo" | "vivo" | "terminado";
  /** Mensaje cuando no hay partidos en la sección. */
  vacio?: string;
}

export function LigaSeccion({
  titulo,
  subtitulo,
  partidos,
  variante,
  vacio,
}: Props) {
  if (partidos.length === 0 && !vacio) return null;

  return (
    <section
      aria-label={titulo}
      className="bg-card px-4 py-5 md:rounded-md md:border md:border-light md:shadow-sm"
    >
      <header className="mb-3">
        <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
          {variante === "vivo" ? (
            <>
              <span aria-hidden className="text-urgent-critical">
                ●
              </span>
              {titulo}
            </>
          ) : (
            titulo
          )}
        </h2>
        {subtitulo ? (
          <p className="mt-1 text-body-sm text-muted-d">{subtitulo}</p>
        ) : null}
      </header>

      {partidos.length === 0 ? (
        <p className="rounded-sm bg-subtle/50 px-4 py-6 text-center text-body-sm text-muted-d">
          {vacio}
        </p>
      ) : (
        <>
          {/* Mobile */}
          <ul className="space-y-2.5 md:hidden">
            {partidos.map((p) => (
              <li key={p.id}>
                <PartidoLigaCardMobile partido={p} variante={variante} />
              </li>
            ))}
          </ul>

          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-md border border-light md:block">
            <table className="w-full text-left">
              <thead className="border-b border-light bg-subtle/60">
                <tr className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
                  <th className="px-4 py-2 font-bold">
                    {variante === "vivo"
                      ? "Min · Liga"
                      : variante === "terminado"
                        ? "Estado · Liga"
                        : "Liga · Hora"}
                  </th>
                  <th className="px-4 py-2 font-bold">Partido</th>
                  <th className="px-4 py-2 font-bold">Tipsters</th>
                  <th className="px-4 py-2 font-bold">
                    {variante === "vivo"
                      ? "Mis pts"
                      : variante === "terminado"
                        ? "Mis pts"
                        : "Mi predicción"}
                  </th>
                  <th className="px-4 py-2 text-right font-bold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {partidos.map((p) => (
                  <PartidoLigaRowDesktop
                    key={p.id}
                    partido={p}
                    variante={variante}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
