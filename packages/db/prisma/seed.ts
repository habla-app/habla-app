import { PrismaClient } from "@prisma/client";
import { CATALOGO_PREMIOS } from "../src/catalog";

// Seed local — idempotente. Usado en desarrollo y reset de dev (`pnpm db:seed`).
//
// El catálogo de 25 premios vive en `packages/db/src/catalog.ts` (fuente de
// verdad única). Para sembrar en producción NO se ejecuta este archivo, sino
// el endpoint admin `POST /api/v1/admin/seed/premios` (Hotfix #9) que reusa
// la misma constante CATALOGO_PREMIOS vía `@habla/db`.
//
// Idempotencia: findFirst({nombre}) + update || create por cada entrada. Re-correr
// el seed sobre una BD ya sembrada deja 25 premios, no 50. Las camisetas con
// nombre idéntico (ej. "Camiseta Universitario Titular") se identifican por
// su nombre completo — el catálogo garantiza unicidad por nombre.
//
// A diferencia de la versión pre-Hotfix #9, ESTE archivo ya NO hace
// `deleteMany()` sobre canjes/premios. Eso borraba historial en cada re-run
// y era peligroso si alguien lo disparaba en prod por accidente.

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
      balanceLukas: 0,
    },
  });
  console.log("Admin upserted:", admin.email);

  let created = 0;
  let updated = 0;

  for (const item of CATALOGO_PREMIOS) {
    const existente = await prisma.premio.findFirst({
      where: { nombre: item.nombre },
      select: { id: true },
    });

    const data = {
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

    if (existente) {
      await prisma.premio.update({ where: { id: existente.id }, data });
      updated++;
    } else {
      await prisma.premio.create({ data });
      created++;
    }
  }

  console.log(
    `Catálogo de premios: ${created} creados, ${updated} actualizados, total ${CATALOGO_PREMIOS.length}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
