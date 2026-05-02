// MisCasasConectadas — sección del perfil con las casas donde el usuario
// reportó FTD (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md +
// docs/ux-spec/00-design-system/componentes-mobile.md §17.
//
// Estado actual (Lote C): el modelo `UsuarioCasa` no existe aún. El service
// `obtenerCasasConectadas` devuelve `[]` siempre — esta sección renderiza
// el empty state con CTA "➕ Conecta una nueva casa". Lote D/E habilita
// el modelo y la sección muestra casas reales con "X apuestas este mes".

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { CasaConectada } from "@/lib/services/usuarios.service";

interface MisCasasConectadasProps {
  casas: CasaConectada[];
}

export function MisCasasConectadas({ casas }: MisCasasConectadasProps) {
  return (
    <section className="bg-card px-4 py-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-display-sm font-bold uppercase tracking-[0.04em] text-dark">
          <span aria-hidden>🏠</span>
          Mis casas conectadas
        </h2>
        <Link
          href="/casas"
          className="text-label-md font-bold text-brand-blue-main hover:underline"
        >
          + Conectar
        </Link>
      </header>

      {casas.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-light">
          {casas.map((casa) => (
            <CasaRow key={casa.slug} casa={casa} />
          ))}
        </ul>
      )}

      <Link
        href="/casas"
        className="mt-3 flex touch-target items-center gap-3 rounded-md border border-dashed border-brand-gold bg-brand-gold-dim px-3.5 py-3 text-label-md font-bold text-brand-gold-dark"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold text-brand-blue-dark"
        >
          +
        </span>
        Conecta una nueva casa (bono S/100 nuevos)
      </Link>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md bg-subtle px-4 py-5 text-center">
      <p className="text-body-sm text-body">
        Aún no tienes casas conectadas.
      </p>
      <p className="mt-1 text-body-xs text-muted-d">
        Cuando conectes una desde /casas, aparecerá acá con bono S/100.
      </p>
    </div>
  );
}

function CasaRow({ casa }: { casa: CasaConectada }) {
  return (
    <Link
      href={`/casas/${casa.slug}`}
      className="flex touch-target items-center gap-3 py-2.5"
    >
      <Avatar
        src={casa.logoUrl ?? undefined}
        name={casa.nombre}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-display-xs font-bold text-dark">
          {casa.nombre}
        </p>
        <p className="text-label-md text-muted-d">
          <span className="font-bold text-alert-success-text">● Activa</span>
          {casa.apuestasMes > 0
            ? ` · ${casa.apuestasMes} apuesta${
                casa.apuestasMes === 1 ? "" : "s"
              } este mes`
            : null}
        </p>
      </div>
      <span aria-hidden className="text-body-md text-brand-blue-main">
        →
      </span>
    </Link>
  );
}
