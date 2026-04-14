import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Crear usuario admin
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@habla.pe" },
    update: {},
    create: {
      email: "admin@habla.pe",
      nombre: "Admin Habla",
      rol: "ADMIN",
      verificado: true,
      balanceLukas: 0,
    },
  });

  console.log("Admin creado:", admin.email);

  // Crear premios de ejemplo
  const premios = await Promise.all([
    prisma.premio.create({
      data: {
        nombre: "Camiseta Peru 2026",
        descripcion: "Camiseta oficial de la seleccion peruana para el Mundial 2026",
        costeLukas: 15000, // 150 Lukas
        stock: 50,
        activo: true,
      },
    }),
    prisma.premio.create({
      data: {
        nombre: "Gift Card S/50",
        descripcion: "Gift card de S/50 para tiendas participantes",
        costeLukas: 5000, // 50 Lukas
        stock: 100,
        activo: true,
      },
    }),
    prisma.premio.create({
      data: {
        nombre: "Balon de Futbol Adidas",
        descripcion: "Balon oficial de futbol Adidas Al Rihla",
        costeLukas: 8000, // 80 Lukas
        stock: 30,
        activo: true,
      },
    }),
  ]);

  console.log(`${premios.length} premios creados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
