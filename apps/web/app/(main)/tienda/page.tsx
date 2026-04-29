// /tienda — catálogo de premios. Sub-Sprint 6.
// Pública: usuarios anónimos ven el catálogo; solo al clickear "canjear"
// se pide sesión.

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  CATEGORIAS_VALIDAS,
  listarPremios,
  type CategoriaPremio,
} from "@/lib/services/premios.service";
import { TiendaContent } from "@/components/tienda/TiendaContent";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { categoria?: string };
}

export default async function TiendaPage({ searchParams }: PageProps) {
  const catRaw = searchParams.categoria;
  const categoria =
    catRaw && (CATEGORIAS_VALIDAS as readonly string[]).includes(catRaw)
      ? (catRaw as CategoriaPremio)
      : null;

  const [session, premiosResult] = await Promise.all([
    auth(),
    listarPremios({ categoria: categoria ?? undefined }),
  ]);

  let totalCanjeados = 0;
  let balanceGanadas = 0;
  if (session?.user?.id) {
    const [canjesCount, usuarioData] = await Promise.all([
      prisma.canje.count({
        where: {
          usuarioId: session.user.id,
          estado: { in: ["ENTREGADO", "ENVIADO", "PROCESANDO"] },
        },
      }),
      prisma.usuario.findUnique({
        where: { id: session.user.id },
        select: { balanceGanadas: true },
      }),
    ]);
    totalCanjeados = canjesCount;
    balanceGanadas = usuarioData?.balanceGanadas ?? 0;
  }

  return (
    <TiendaContent
      premios={premiosResult.premios}
      featured={premiosResult.featured}
      categoriaActiva={categoria}
      initialBalance={session?.user?.balanceLukas ?? null}
      initialBalanceGanadas={balanceGanadas}
      totalCanjeados={totalCanjeados}
      isLoggedIn={Boolean(session?.user?.id)}
    />
  );
}
