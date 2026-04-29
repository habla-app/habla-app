# Habla! - Torneos de Predicciones Deportivas

Plataforma web de torneos de predicciones de futbol orientada al mercado peruano. Los usuarios compran **Lukas** (moneda virtual) para inscribirse en torneos sobre partidos reales, envian sus predicciones y compiten por premios canjeables en la tienda integrada.

**Fecha de lanzamiento:** 11 de junio de 2026 (Dia 1 del Mundial FIFA 2026)

---

## Como funciona

1. El usuario se registra y compra Lukas con soles peruanos (via Culqi)
2. Elige un torneo activo y paga la entrada en Lukas
3. Envia su ticket con 5 predicciones sobre un partido real
4. Durante el partido, los puntos se calculan automaticamente en tiempo real
5. Al finalizar, los premios se distribuyen automaticamente entre los ganadores
6. Los ganadores canjean sus Lukas por productos reales en la tienda

## Stack tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 14 (React + SSR + PWA) |
| Backend API | Node.js + Fastify |
| Base de datos | PostgreSQL 16 |
| Cache / Tiempo real | Redis 7 |
| ORM | Prisma |
| WebSockets | Socket.io |
| Auth | NextAuth.js v5 |
| Pagos | OpenPay (BBVA, integración pendiente Lote 12) |
| API deportiva | API-Football (RapidAPI) |
| Hosting | Railway |

## Estructura del proyecto

```
habla-app/                    Monorepo con pnpm workspaces
  apps/
    web/                      Frontend Next.js (puerto 3000)
    api/                      Backend Fastify (puerto 3001)
  packages/
    db/                       Prisma schema + migraciones
    shared/                   Tipos y constantes compartidas
    ui/                       Design system (futuro)
```

## Requisitos previos

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** y **Docker Compose** (para PostgreSQL y Redis locales)

## Inicio rapido

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd habla-app

# 2. Instalar dependencias
pnpm install

# 3. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Levantar base de datos y Redis
docker-compose up -d

# 5. Ejecutar migraciones y seed
pnpm db:migrate
pnpm db:seed

# 6. Iniciar en desarrollo
pnpm dev
```

Esto levanta:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

## Scripts principales

| Comando | Que hace |
|---------|----------|
| `pnpm dev` | Levanta frontend + backend en desarrollo |
| `pnpm build` | Build de produccion de todo el monorepo |
| `pnpm test` | Ejecuta todos los tests |
| `pnpm lint` | Ejecuta linter en todo el proyecto |
| `pnpm db:migrate` | Genera y aplica migraciones de Prisma |
| `pnpm db:seed` | Carga datos iniciales (admin + premios demo) |
| `pnpm db:studio` | Abre Prisma Studio (interfaz visual de la BD) |
| `docker-compose up -d` | Levanta PostgreSQL + Redis |
| `docker-compose down` | Detiene PostgreSQL + Redis |

## Sistema de predicciones

Cada ticket contiene 5 predicciones sobre un partido:

| # | Prediccion | Puntos | Dificultad |
|---|-----------|--------|------------|
| 1 | Resultado: Local / Empate / Visita | 3 pts | Baja |
| 2 | Ambos equipos anotan (BTTS) | 2 pts | Baja-Media |
| 3 | Mas de 2.5 goles | 2 pts | Media |
| 4 | Habra tarjeta roja | 6 pts | Alta |
| 5 | Marcador exacto | 8 pts | Muy alta |

**Maximo por ticket:** 21 puntos.

## Modelo economico

- **Rake:** 12% del pozo bruto (ingreso de la plataforma)
- Los Lukas tienen paridad 1:1 con el sol peruano
- Los Lukas comprados vencen a los 12 meses
- Los Lukas **no son retirables como efectivo** (creditos de entretenimiento)

## Convenciones de codigo

- TypeScript strict en todo el proyecto
- Archivos: kebab-case (`torneo.service.ts`)
- Funciones/variables: camelCase
- Tipos/clases: PascalCase
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`)
- Validacion de datos con Zod
- Errores tipados (nunca `throw new Error('string')`)

## Documentacion

Documentacion detallada en la carpeta `/docs`:
- [Arquitectura](docs/arquitectura.md)
- [API Endpoints](docs/api.md)
- [Modelo de Datos](docs/modelo-datos.md)
- [Ranking en Vivo](docs/ranking-en-vivo.md)
- [Deploy](docs/deploy.md)

Para reglas de negocio completas, ver [CLAUDE.md](CLAUDE.md).

## Licencia

Proyecto privado. Todos los derechos reservados.
