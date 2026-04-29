import { PrismaClient } from "@prisma/client";

// Seed local — idempotente. Usado en desarrollo y reset de dev (`pnpm db:seed`).
//
// Lote 3 (Abr 2026): se removió el catálogo de premios (la tienda fue
// demolida). El seed solo crea el usuario admin de cortesía. Cualquier
// torneo demo se siembra manualmente vía `/admin` (que importa partidos
// de api-football y crea torneos sobre ellos).

const prisma = new PrismaClient();

async function main() {
  // Admin de cortesía para el panel /admin en dev. En prod el admin se
  // promueve manualmente cambiando `rol` a "ADMIN" vía Prisma Studio sobre
  // un usuario que ya se registró con magic link.
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@habla.pe" },
    update: {},
    create: {
      email: "admin@habla.pe",
      nombre: "Admin Habla",
      username: "admin_habla",
      usernameLocked: true,
      tycAceptadosAt: new Date(),
      rol: "ADMIN",
      verificado: true,
    },
  });
  console.log("Admin upserted:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
