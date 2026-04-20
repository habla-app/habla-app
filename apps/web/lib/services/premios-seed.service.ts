// Servicio de seed del catálogo de premios — Hotfix #9.
//
// Usa la constante `CATALOGO_PREMIOS` de `@habla/db` (fuente de verdad única)
// y ejecuta un upsert idempotente sobre la tabla `premios`. Consumido por el
// endpoint `POST /api/v1/admin/seed/premios` — única vía para poblar el
// catálogo en producción sin depender de `pnpm db:seed` (que requiere Railway
// CLI + acceso shell al contenedor).
//
// Idempotencia: por cada item del catálogo hace `findFirst({nombre})` →
// update si existe, create si no. Una segunda corrida no duplica — deja
// 25 premios, no 50. La comparación por `nombre` es segura porque el catálogo
// garantiza unicidad (documentado en `packages/db/src/catalog.ts`).
//
// Observabilidad: devuelve contadores `{created, updated, total}` + logs
// estructurados con Pino. Nunca lanza para errores "premio ya existe" — eso
// se refleja en `updated`, no en una excepción.
//
// Seguridad: este service NO chequea autenticación. El route handler del
// endpoint es el responsable de exigir `session.user.rol === "ADMIN"`.

import {
  prisma,
  CATALOGO_PREMIOS,
  type CatalogoCategoria,
  type CatalogoPremio,
} from "@habla/db";
import { logger } from "./logger";

export interface SeedResultado {
  /** Premios nuevos creados. */
  creados: number;
  /** Premios actualizados (ya existían con el mismo nombre). */
  actualizados: number;
  /** Total del catálogo esperado (siempre 25 con el MVP actual). */
  totalCatalogo: number;
  /** Total de premios en BD post-seed. */
  totalEnBD: number;
  /** Timestamp de la corrida. */
  ejecutadoEn: string;
}

export interface StatusCatalogo {
  /** Total de premios activos en BD. */
  totalPremios: number;
  /** Premios activos con stock > 0. */
  conStock: number;
  /** Breakdown por categoría (solo activos). */
  porCategoria: Record<CatalogoCategoria, number>;
  /** Total esperado según CATALOGO_PREMIOS (constante del repo). */
  catalogoEsperado: number;
  /** True si el seed necesita correr (BD tiene menos premios que el catálogo). */
  faltaSembrar: boolean;
}

/**
 * Siembra el catálogo de premios en la BD. Idempotente: seguro re-correrlo.
 * Llamado desde el endpoint admin en producción para cerrar la brecha entre
 * "lo que documenta el código" y "lo que el usuario ve en /tienda".
 */
export async function sembrarCatalogoPremios(): Promise<SeedResultado> {
  let creados = 0;
  let actualizados = 0;

  for (const item of CATALOGO_PREMIOS) {
    const existente = await prisma.premio.findFirst({
      where: { nombre: item.nombre },
      select: { id: true },
    });

    const data = buildPremioData(item);

    if (existente) {
      await prisma.premio.update({
        where: { id: existente.id },
        data,
      });
      actualizados++;
    } else {
      await prisma.premio.create({ data });
      creados++;
    }
  }

  const totalEnBD = await prisma.premio.count();
  const resultado: SeedResultado = {
    creados,
    actualizados,
    totalCatalogo: CATALOGO_PREMIOS.length,
    totalEnBD,
    ejecutadoEn: new Date().toISOString(),
  };

  logger.info(resultado, "sembrarCatalogoPremios completado");
  return resultado;
}

/**
 * Status actual del catálogo en BD. Usado por `GET /admin/seed/premios/status`
 * y por dashboards admin futuros.
 */
export async function obtenerStatusCatalogo(): Promise<StatusCatalogo> {
  const [totalPremios, conStock, porCatRaw] = await Promise.all([
    prisma.premio.count({ where: { activo: true } }),
    prisma.premio.count({ where: { activo: true, stock: { gt: 0 } } }),
    prisma.premio.groupBy({
      by: ["categoria"],
      where: { activo: true },
      _count: { _all: true },
    }),
  ]);

  const porCategoria: Record<CatalogoCategoria, number> = {
    ENTRADA: 0,
    CAMISETA: 0,
    GIFT: 0,
    TECH: 0,
    EXPERIENCIA: 0,
  };
  for (const row of porCatRaw) {
    const cat = row.categoria as CatalogoCategoria;
    porCategoria[cat] = row._count._all;
  }

  return {
    totalPremios,
    conStock,
    porCategoria,
    catalogoEsperado: CATALOGO_PREMIOS.length,
    faltaSembrar: totalPremios < CATALOGO_PREMIOS.length,
  };
}

function buildPremioData(item: CatalogoPremio) {
  return {
    nombre: item.nombre,
    descripcion: item.descripcion,
    costeLukas: item.costeLukas,
    stock: item.stock,
    categoria: item.categoria,
    badge: item.badge ?? null,
    featured: item.featured ?? false,
    requiereDireccion: item.requiereDireccion,
    valorSoles: item.valorSoles,
    imagen: item.imagen,
    activo: true,
  };
}
