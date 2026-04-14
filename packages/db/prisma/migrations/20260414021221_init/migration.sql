-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('JUGADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoPartido" AS ENUM ('PROGRAMADO', 'EN_VIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoTorneo" AS ENUM ('EXPRESS', 'ESTANDAR', 'PREMIUM', 'GRAN_TORNEO');

-- CreateEnum
CREATE TYPE "EstadoTorneo" AS ENUM ('ABIERTO', 'CERRADO', 'EN_JUEGO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ResultadoPred" AS ENUM ('LOCAL', 'EMPATE', 'VISITA');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('COMPRA', 'ENTRADA_TORNEO', 'PREMIO_TORNEO', 'CANJE', 'BONUS', 'VENCIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoCanje" AS ENUM ('PENDIENTE', 'PROCESANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "fechaNac" TIMESTAMP(3),
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "rol" "Rol" NOT NULL DEFAULT 'JUGADOR',
    "balanceLukas" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partidos" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "liga" TEXT NOT NULL,
    "equipoLocal" TEXT NOT NULL,
    "equipoVisita" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPartido" NOT NULL DEFAULT 'PROGRAMADO',
    "golesLocal" INTEGER,
    "golesVisita" INTEGER,
    "btts" BOOLEAN,
    "mas25Goles" BOOLEAN,
    "huboTarjetaRoja" BOOLEAN,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoTorneo" NOT NULL,
    "entradaLukas" INTEGER NOT NULL,
    "partidoId" TEXT NOT NULL,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'ABIERTO',
    "totalInscritos" INTEGER NOT NULL DEFAULT 0,
    "pozoBruto" INTEGER NOT NULL DEFAULT 0,
    "pozoNeto" INTEGER NOT NULL DEFAULT 0,
    "rake" INTEGER NOT NULL DEFAULT 0,
    "cierreAt" TIMESTAMP(3) NOT NULL,
    "distribPremios" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "predResultado" "ResultadoPred" NOT NULL,
    "predBtts" BOOLEAN NOT NULL,
    "predMas25" BOOLEAN NOT NULL,
    "predTarjetaRoja" BOOLEAN NOT NULL,
    "predMarcadorLocal" INTEGER NOT NULL,
    "predMarcadorVisita" INTEGER NOT NULL,
    "puntosTotal" INTEGER NOT NULL DEFAULT 0,
    "puntosResultado" INTEGER NOT NULL DEFAULT 0,
    "puntosBtts" INTEGER NOT NULL DEFAULT 0,
    "puntosMas25" INTEGER NOT NULL DEFAULT 0,
    "puntosTarjeta" INTEGER NOT NULL DEFAULT 0,
    "puntosMarcador" INTEGER NOT NULL DEFAULT 0,
    "posicionFinal" INTEGER,
    "premioLukas" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_lukas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "refId" TEXT,
    "venceEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacciones_lukas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "costeLukas" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imagen" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canjes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "premioId" TEXT NOT NULL,
    "lukasUsados" INTEGER NOT NULL,
    "estado" "EstadoCanje" NOT NULL DEFAULT 'PENDIENTE',
    "direccion" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canjes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "partidos_externalId_key" ON "partidos"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_usuarioId_torneoId_predResultado_predBtts_predMas25_key" ON "tickets"("usuarioId", "torneoId", "predResultado", "predBtts", "predMas25", "predTarjetaRoja", "predMarcadorLocal", "predMarcadorVisita");

-- AddForeignKey
ALTER TABLE "torneos" ADD CONSTRAINT "torneos_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "partidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "torneos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_lukas" ADD CONSTRAINT "transacciones_lukas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canjes" ADD CONSTRAINT "canjes_premioId_fkey" FOREIGN KEY ("premioId") REFERENCES "premios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
