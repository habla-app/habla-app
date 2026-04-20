import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Catálogo de premios del MVP (Sub-Sprint 6).
// Convenciones:
//   - Precios en Lukas con margen del ~30% sobre el valor real estimado
//     (decisión autónoma CLAUDE.md §15). 1 Luka = S/ 1.
//   - 5 categorías según §10.6 del mockup: ENTRADA, CAMISETA, GIFT, TECH, EXPERIENCIA.
//   - Badges según §10.6: POPULAR (3), NUEVO (2), LIMITADO (1).
//   - `featured: true` marca el Featured Prize del hero de /tienda (1 solo).
//   - `requiereDireccion: true` para premios físicos que requieren envío.
//   - `valorSoles` es referencia interna (no se muestra al jugador).
const PREMIOS_CATALOGO = [
  // ENTRADAS (5)
  {
    nombre: "Entrada doble al Monumental",
    descripcion: "Dos entradas para cualquier partido de Liga 1 en el Estadio Monumental.",
    categoria: "ENTRADA" as const,
    costeLukas: 120,
    valorSoles: 100,
    stock: 20,
    badge: "POPULAR" as const,
    featured: true,
    requiereDireccion: false,
    imagen: "🏟️",
  },
  {
    nombre: "Entrada al Estadio Nacional",
    descripcion: "Entrada general para partido de la selección peruana.",
    categoria: "ENTRADA" as const,
    costeLukas: 95,
    valorSoles: 80,
    stock: 30,
    badge: "POPULAR" as const,
    featured: false,
    requiereDireccion: false,
    imagen: "🎟️",
  },
  {
    nombre: "Entrada VIP Alianza Lima",
    descripcion: "Entrada en zona preferente para un partido de Alianza Lima en Matute.",
    categoria: "ENTRADA" as const,
    costeLukas: 180,
    valorSoles: 150,
    stock: 8,
    badge: "LIMITADO" as const,
    featured: false,
    requiereDireccion: false,
    imagen: "🎫",
  },
  {
    nombre: "Entrada Universitario vs Rival",
    descripcion: "Entrada oriente para partido de la 'U' en el Monumental.",
    categoria: "ENTRADA" as const,
    costeLukas: 85,
    valorSoles: 70,
    stock: 25,
    requiereDireccion: false,
    imagen: "🎟️",
  },
  {
    nombre: "Experiencia palco Sporting Cristal",
    descripcion: "Palco para dos personas con bocaditos incluidos en el Gallardo.",
    categoria: "ENTRADA" as const,
    costeLukas: 350,
    valorSoles: 280,
    stock: 3,
    badge: "LIMITADO" as const,
    featured: false,
    requiereDireccion: false,
    imagen: "🥂",
  },

  // CAMISETAS (5)
  {
    nombre: "Camiseta Perú 2026",
    descripcion: "Camiseta oficial de la selección peruana para el Mundial FIFA 2026.",
    categoria: "CAMISETA" as const,
    costeLukas: 190,
    valorSoles: 150,
    stock: 40,
    badge: "NUEVO" as const,
    featured: false,
    requiereDireccion: true,
    imagen: "🇵🇪",
  },
  {
    nombre: "Camiseta Alianza Lima Titular",
    descripcion: "Camiseta oficial de Alianza Lima temporada 2026.",
    categoria: "CAMISETA" as const,
    costeLukas: 150,
    valorSoles: 120,
    stock: 35,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Universitario Titular",
    descripcion: "Camiseta oficial de Universitario de Deportes 2026.",
    categoria: "CAMISETA" as const,
    costeLukas: 150,
    valorSoles: 120,
    stock: 35,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Sporting Cristal Celeste",
    descripcion: "Camiseta oficial de Sporting Cristal temporada 2026.",
    categoria: "CAMISETA" as const,
    costeLukas: 150,
    valorSoles: 120,
    stock: 30,
    requiereDireccion: true,
    imagen: "👕",
  },
  {
    nombre: "Camiseta Firmada Paolo Guerrero",
    descripcion: "Camiseta de colección autografiada por Paolo Guerrero. Edición limitada.",
    categoria: "CAMISETA" as const,
    costeLukas: 650,
    valorSoles: 500,
    stock: 2,
    badge: "LIMITADO" as const,
    featured: false,
    requiereDireccion: true,
    imagen: "✍️",
  },

  // GIFT CARDS (6)
  {
    nombre: "Gift Card Plaza Vea S/ 50",
    descripcion: "Gift card digital de S/ 50 canjeable en Plaza Vea y Vivanda.",
    categoria: "GIFT" as const,
    costeLukas: 65,
    valorSoles: 50,
    stock: 100,
    badge: "POPULAR" as const,
    featured: false,
    requiereDireccion: false,
    imagen: "🛒",
  },
  {
    nombre: "Gift Card Plaza Vea S/ 100",
    descripcion: "Gift card digital de S/ 100 canjeable en Plaza Vea y Vivanda.",
    categoria: "GIFT" as const,
    costeLukas: 125,
    valorSoles: 100,
    stock: 80,
    requiereDireccion: false,
    imagen: "🛒",
  },
  {
    nombre: "Gift Card Falabella S/ 50",
    descripcion: "Gift card digital de S/ 50 para Falabella online y tiendas.",
    categoria: "GIFT" as const,
    costeLukas: 65,
    valorSoles: 50,
    stock: 100,
    requiereDireccion: false,
    imagen: "🎁",
  },
  {
    nombre: "Gift Card Saga Falabella S/ 100",
    descripcion: "Gift card digital de S/ 100 para Saga Falabella online.",
    categoria: "GIFT" as const,
    costeLukas: 125,
    valorSoles: 100,
    stock: 60,
    requiereDireccion: false,
    imagen: "🎁",
  },
  {
    nombre: "Gift Card Netflix 1 mes",
    descripcion: "Código digital para 1 mes de Netflix plan estándar.",
    categoria: "GIFT" as const,
    costeLukas: 40,
    valorSoles: 33,
    stock: 150,
    requiereDireccion: false,
    imagen: "🎬",
  },
  {
    nombre: "Gift Card Spotify 3 meses",
    descripcion: "Código digital para 3 meses de Spotify Premium.",
    categoria: "GIFT" as const,
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
    categoria: "TECH" as const,
    costeLukas: 320,
    valorSoles: 260,
    stock: 15,
    badge: "POPULAR" as const,
    featured: false,
    requiereDireccion: true,
    imagen: "🎧",
  },
  {
    nombre: "Cargador inalámbrico 15W",
    descripcion: "Cargador inalámbrico rápido compatible con iPhone y Android.",
    categoria: "TECH" as const,
    costeLukas: 80,
    valorSoles: 65,
    stock: 40,
    requiereDireccion: true,
    imagen: "🔌",
  },
  {
    nombre: "Parlante Bluetooth JBL Go 3",
    descripcion: "Parlante portátil JBL Go 3 con batería para 5 horas.",
    categoria: "TECH" as const,
    costeLukas: 130,
    valorSoles: 100,
    stock: 25,
    requiereDireccion: true,
    imagen: "🔊",
  },
  {
    nombre: "Power bank 10000mAh",
    descripcion: "Batería externa 10000mAh con carga rápida para celular.",
    categoria: "TECH" as const,
    costeLukas: 75,
    valorSoles: 60,
    stock: 50,
    requiereDireccion: true,
    imagen: "🔋",
  },
  {
    nombre: "Smartwatch deportivo",
    descripcion: "Reloj inteligente con tracker de pasos, ritmo cardíaco y notificaciones.",
    categoria: "TECH" as const,
    costeLukas: 280,
    valorSoles: 220,
    stock: 12,
    badge: "NUEVO" as const,
    featured: false,
    requiereDireccion: true,
    imagen: "⌚",
  },
  {
    nombre: "Teclado mecánico gamer RGB",
    descripcion: "Teclado mecánico compacto con switches azules y RGB.",
    categoria: "TECH" as const,
    costeLukas: 250,
    valorSoles: 200,
    stock: 10,
    requiereDireccion: true,
    imagen: "⌨️",
  },

  // EXPERIENCIAS (3)
  {
    nombre: "Cena para dos en La Mar",
    descripcion: "Cena degustación para dos personas en La Mar Cebichería — Gastón Acurio.",
    categoria: "EXPERIENCIA" as const,
    costeLukas: 450,
    valorSoles: 350,
    stock: 5,
    badge: "LIMITADO" as const,
    featured: false,
    requiereDireccion: false,
    imagen: "🍽️",
  },
  {
    nombre: "Clase con entrenador certificado",
    descripcion: "Clase de fútbol con entrenador UEFA certificado en cancha sintética.",
    categoria: "EXPERIENCIA" as const,
    costeLukas: 180,
    valorSoles: 140,
    stock: 8,
    requiereDireccion: false,
    imagen: "⚽",
  },
  {
    nombre: "Tour por el Estadio Nacional",
    descripcion: "Tour guiado por el Estadio Nacional + acceso a vestuarios.",
    categoria: "EXPERIENCIA" as const,
    costeLukas: 90,
    valorSoles: 70,
    stock: 20,
    requiereDireccion: false,
    imagen: "🏟️",
  },
];

async function main() {
  // Crear usuario admin
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@habla.pe" },
    update: {},
    create: {
      email: "admin@habla.pe",
      nombre: "Admin Habla",
      username: "admin",
      rol: "ADMIN",
      verificado: true,
      balanceLukas: 0,
    },
  });

  console.log("Admin creado:", admin.email);

  // Limpiar premios existentes (permite re-seed en desarrollo).
  // ATENCIÓN: en producción esto NO debe correr — usar solo en seed inicial.
  await prisma.canje.deleteMany({});
  await prisma.premio.deleteMany({});

  // Crear catálogo completo.
  for (const p of PREMIOS_CATALOGO) {
    await prisma.premio.create({
      data: {
        nombre: p.nombre,
        descripcion: p.descripcion,
        costeLukas: p.costeLukas,
        stock: p.stock,
        categoria: p.categoria,
        badge: p.badge ?? null,
        featured: p.featured ?? false,
        requiereDireccion: p.requiereDireccion,
        valorSoles: p.valorSoles,
        imagen: p.imagen,
        activo: true,
      },
    });
  }

  console.log(`${PREMIOS_CATALOGO.length} premios creados en el catálogo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
