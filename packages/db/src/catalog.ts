// Catálogo de premios del MVP (Sub-Sprint 6). Fuente de verdad única
// consumida por:
//   1. `packages/db/prisma/seed.ts` — seed local / reset de dev.
//   2. `apps/web/lib/services/premios-seed.service.ts` — seed en producción
//      via `POST /api/v1/admin/seed/premios` (Hotfix #9).
//
// REGLA: cualquier cambio de catálogo se hace acá. Prohibido duplicar esta
// constante en apps/web o reescribirla inline en route handlers.
//
// Convenciones (CLAUDE.md §15):
//  - Precios en Lukas con margen ~30% sobre valor real estimado (1 Luka = S/ 1).
//  - 5 categorías según §10.6: ENTRADA, CAMISETA, GIFT, TECH, EXPERIENCIA.
//  - Badges según §10.6: POPULAR (3), NUEVO (2), LIMITADO (3).
//  - `featured: true` marca el Featured Prize del hero de /tienda (1 solo).
//  - `requiereDireccion: true` para premios físicos que requieren envío.
//  - `valorSoles` es referencia interna (no se muestra al jugador).

export type CatalogoCategoria =
  | "ENTRADA"
  | "CAMISETA"
  | "GIFT"
  | "TECH"
  | "EXPERIENCIA";

export type CatalogoBadge = "POPULAR" | "NUEVO" | "LIMITADO";

export interface CatalogoPremio {
  nombre: string;
  descripcion: string;
  categoria: CatalogoCategoria;
  costeLukas: number;
  valorSoles: number;
  stock: number;
  badge?: CatalogoBadge;
  featured?: boolean;
  requiereDireccion: boolean;
  imagen: string;
}

export const CATALOGO_PREMIOS: ReadonlyArray<CatalogoPremio> = [
  // ENTRADAS (5)
  {
    nombre: "Entrada doble al Monumental",
    descripcion:
      "Dos entradas para cualquier partido de Liga 1 en el Estadio Monumental.",
    categoria: "ENTRADA",
    costeLukas: 120,
    valorSoles: 100,
    stock: 20,
    badge: "POPULAR",
    featured: true,
    requiereDireccion: false,
    imagen: "🏟️",
  },
  {
    nombre: "Entrada al Estadio Nacional",
    descripcion: "Entrada general para partido de la selección peruana.",
    categoria: "ENTRADA",
    costeLukas: 95,
    valorSoles: 80,
    stock: 30,
    badge: "POPULAR",
    featured: false,
    requiereDireccion: false,
    imagen: "🎟️",
  },
  {
    nombre: "Entrada VIP Alianza Lima",
    descripcion:
      "Entrada en zona preferente para un partido de Alianza Lima en Matute.",
    categoria: "ENTRADA",
    costeLukas: 180,
    valorSoles: 150,
    stock: 8,
    badge: "LIMITADO",
    featured: false,
    requiereDireccion: false,
    imagen: "🎫",
  },
  {
    nombre: "Entrada Universitario vs Rival",
    descripcion: "Entrada oriente para partido de la 'U' en el Monumental.",
    categoria: "ENTRADA",
    costeLukas: 85,
    valorSoles: 70,
    stock: 25,
    requiereDireccion: false,
    imagen: "🎟️",
  },
  {
    nombre: "Experiencia palco Sporting Cristal",
    descripcion:
      "Palco para dos personas con bocaditos incluidos en el Gallardo.",
    categoria: "ENTRADA",
    costeLukas: 350,
    valorSoles: 280,
    stock: 3,
    badge: "LIMITADO",
    featured: false,
    requiereDireccion: false,
    imagen: "🥂",
  },

  // CAMISETAS (5)
  {
    nombre: "Camiseta Perú 2026",
    descripcion:
      "Camiseta oficial de la selección peruana para el Mundial FIFA 2026.",
    categoria: "CAMISETA",
    costeLukas: 190,
    valorSoles: 150,
    stock: 40,
    badge: "NUEVO",
    featured: false,
    requiereDireccion: true,
    imagen: "🇵🇪",
  },
  {
    nombre: "Camiseta Alianza Lima Titular",
    descripcion: "Camiseta oficial de Alianza Lima temporada 2026.",
    categoria: "CAMISETA",
    costeLukas: 150,
    valorSoles: 120,
    stock: 35,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Universitario Titular",
    descripcion: "Camiseta oficial de Universitario de Deportes 2026.",
    categoria: "CAMISETA",
    costeLukas: 150,
    valorSoles: 120,
    stock: 35,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Sporting Cristal Celeste",
    descripcion: "Camiseta oficial de Sporting Cristal temporada 2026.",
    categoria: "CAMISETA",
    costeLukas: 150,
    valorSoles: 120,
    stock: 30,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Firmada Paolo Guerrero",
    descripcion:
      "Camiseta de colección autografiada por Paolo Guerrero. Edición limitada.",
    categoria: "CAMISETA",
    costeLukas: 650,
    valorSoles: 500,
    stock: 2,
    badge: "LIMITADO",
    featured: false,
    requiereDireccion: true,
    imagen: "✍️",
  },

  // GIFT CARDS (6)
  {
    nombre: "Gift Card Plaza Vea S/ 50",
    descripcion: "Gift card digital de S/ 50 canjeable en Plaza Vea y Vivanda.",
    categoria: "GIFT",
    costeLukas: 65,
    valorSoles: 50,
    stock: 100,
    badge: "POPULAR",
    featured: false,
    requiereDireccion: false,
    imagen: "🛒",
  },
  {
    nombre: "Gift Card Plaza Vea S/ 100",
    descripcion:
      "Gift card digital de S/ 100 canjeable en Plaza Vea y Vivanda.",
    categoria: "GIFT",
    costeLukas: 125,
    valorSoles: 100,
    stock: 80,
    requiereDireccion: false,
    imagen: "🛒",
  },
  {
    nombre: "Gift Card Falabella S/ 50",
    descripcion: "Gift card digital de S/ 50 para Falabella online y tiendas.",
    categoria: "GIFT",
    costeLukas: 65,
    valorSoles: 50,
    stock: 100,
    requiereDireccion: false,
    imagen: "🎁",
  },
  {
    nombre: "Gift Card Saga Falabella S/ 100",
    descripcion: "Gift card digital de S/ 100 para Saga Falabella online.",
    categoria: "GIFT",
    costeLukas: 125,
    valorSoles: 100,
    stock: 60,
    requiereDireccion: false,
    imagen: "🎁",
  },
  {
    nombre: "Gift Card Netflix 1 mes",
    descripcion: "Código digital para 1 mes de Netflix plan estándar.",
    categoria: "GIFT",
    costeLukas: 40,
    valorSoles: 33,
    stock: 150,
    requiereDireccion: false,
    imagen: "🎬",
  },
  {
    nombre: "Gift Card Spotify 3 meses",
    descripcion: "Código digital para 3 meses de Spotify Premium.",
    categoria: "GIFT",
    costeLukas: 55,
    valorSoles: 42,
    stock: 100,
    requiereDireccion: false,
    imagen: "🎵",
  },

  // TECH (6)
  {
    nombre: "Audífonos inalámbricos Samsung",
    descripcion: "Audífonos Samsung Galaxy Buds Live — cancelación de ruido.",
    categoria: "TECH",
    costeLukas: 320,
    valorSoles: 260,
    stock: 15,
    badge: "POPULAR",
    featured: false,
    requiereDireccion: true,
    imagen: "🎧",
  },
  {
    nombre: "Cargador inalámbrico 15W",
    descripcion:
      "Cargador inalámbrico rápido compatible con iPhone y Android.",
    categoria: "TECH",
    costeLukas: 80,
    valorSoles: 65,
    stock: 40,
    requiereDireccion: true,
    imagen: "🔌",
  },
  {
    nombre: "Parlante Bluetooth JBL Go 3",
    descripcion: "Parlante portátil JBL Go 3 con batería para 5 horas.",
    categoria: "TECH",
    costeLukas: 130,
    valorSoles: 100,
    stock: 25,
    requiereDireccion: true,
    imagen: "🔊",
  },
  {
    nombre: "Power bank 10000mAh",
    descripcion: "Batería externa 10000mAh con carga rápida para celular.",
    categoria: "TECH",
    costeLukas: 75,
    valorSoles: 60,
    stock: 50,
    requiereDireccion: true,
    imagen: "🔋",
  },
  {
    nombre: "Smartwatch deportivo",
    descripcion:
      "Reloj inteligente con tracker de pasos, ritmo cardíaco y notificaciones.",
    categoria: "TECH",
    costeLukas: 280,
    valorSoles: 220,
    stock: 12,
    badge: "NUEVO",
    featured: false,
    requiereDireccion: true,
    imagen: "⌚",
  },
  {
    nombre: "Teclado mecánico gamer RGB",
    descripcion: "Teclado mecánico compacto con switches azules y RGB.",
    categoria: "TECH",
    costeLukas: 250,
    valorSoles: 200,
    stock: 10,
    requiereDireccion: true,
    imagen: "⌨️",
  },

  // EXPERIENCIAS (3)
  {
    nombre: "Cena para dos en La Mar",
    descripcion:
      "Cena degustación para dos personas en La Mar Cebichería — Gastón Acurio.",
    categoria: "EXPERIENCIA",
    costeLukas: 450,
    valorSoles: 350,
    stock: 5,
    badge: "LIMITADO",
    featured: false,
    requiereDireccion: false,
    imagen: "🍽️",
  },
  {
    nombre: "Clase con entrenador certificado",
    descripcion:
      "Clase de fútbol con entrenador UEFA certificado en cancha sintética.",
    categoria: "EXPERIENCIA",
    costeLukas: 180,
    valorSoles: 140,
    stock: 8,
    requiereDireccion: false,
    imagen: "⚽",
  },
  {
    nombre: "Tour por el Estadio Nacional",
    descripcion: "Tour guiado por el Estadio Nacional + acceso a vestuarios.",
    categoria: "EXPERIENCIA",
    costeLukas: 90,
    valorSoles: 70,
    stock: 20,
    requiereDireccion: false,
    imagen: "🏟️",
  },
];
