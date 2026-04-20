// Servicio de premios — Sub-Sprint 6.
//
// Listar catálogo con filtros (categoría, activo, featured), obtener detalle
// individual. El flujo de canje vive en `canjes.service.ts`.
//
// Convenciones:
//  - Solo se devuelven premios activos por default (override con `incluirInactivos=true`).
//  - Stock 0 queda visible en el catálogo (para mostrar "agotado") a menos que
//    explícitamente se filtre con `soloConStock=true`.
//  - Categoría es enum estricto (`CategoriaPremio`): si el caller pasa string
//    inválido, se ignora el filtro.

import { prisma, Prisma } from "@habla/db";
import { DomainError } from "./errors";

export const CATEGORIAS_VALIDAS = [
  "ENTRADA",
  "CAMISETA",
  "GIFT",
  "TECH",
  "EXPERIENCIA",
] as const;
export type CategoriaPremio = (typeof CATEGORIAS_VALIDAS)[number];

export interface PremioDTO {
  id: string;
  nombre: string;
  descripcion: string;
  costeLukas: number;
  stock: number;
  imagen: string | null;
  categoria: CategoriaPremio;
  badge: "POPULAR" | "NUEVO" | "LIMITADO" | null;
  featured: boolean;
  requiereDireccion: boolean;
  activo: boolean;
  creadoEn: Date;
}

export interface ListarPremiosInput {
  categoria?: CategoriaPremio;
  soloConStock?: boolean;
  incluirInactivos?: boolean;
  featuredFirst?: boolean;
}

export interface ListarPremiosResult {
  premios: PremioDTO[];
  featured: PremioDTO | null;
}

function toDTO(p: {
  id: string;
  nombre: string;
  descripcion: string;
  costeLukas: number;
  stock: number;
  imagen: string | null;
  categoria: CategoriaPremio;
  badge: "POPULAR" | "NUEVO" | "LIMITADO" | null;
  featured: boolean;
  requiereDireccion: boolean;
  activo: boolean;
  creadoEn: Date;
}): PremioDTO {
  return { ...p };
}

export async function listarPremios(
  input: ListarPremiosInput = {},
): Promise<ListarPremiosResult> {
  const where: Prisma.PremioWhereInput = {};
  if (!input.incluirInactivos) where.activo = true;
  if (
    input.categoria &&
    (CATEGORIAS_VALIDAS as readonly string[]).includes(input.categoria)
  ) {
    where.categoria = input.categoria;
  }
  if (input.soloConStock) where.stock = { gt: 0 };

  const raw = await prisma.premio.findMany({
    where,
    orderBy: [
      { featured: "desc" },
      { costeLukas: "asc" },
      { creadoEn: "asc" },
    ],
  });

  const premios = raw.map((p) => toDTO(p as unknown as PremioDTO));
  // Featured: el primero con featured=true dentro del filtro. Si el filtro
  // fuerza una categoría y no hay featured en esa categoría, queda null.
  const featured = premios.find((p) => p.featured) ?? null;

  return { premios, featured };
}

export async function obtenerPremio(id: string): Promise<PremioDTO> {
  const p = await prisma.premio.findUnique({ where: { id } });
  if (!p) {
    throw new DomainError("PREMIO_NO_ENCONTRADO", `No existe el premio ${id}.`, 404, {
      id,
    });
  }
  return toDTO(p as unknown as PremioDTO);
}
