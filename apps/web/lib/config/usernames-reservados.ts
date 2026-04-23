// Usernames reservados (Abr 2026) — no elegibles por usuarios regulares.
//
// Incluye:
//  - Rutas internas (/admin, /auth/*, /api/*)
//  - Palabras operativas (soporte, support, help)
//  - Roles (admin, root, owner)
//  - Términos técnicos que podrían causar ambigüedad (null, undefined, api)
//  - Dominios / handles propios (habla, hablaapp, hablaplay)
//
// El check es case-insensitive (los usernames se almacenan lowercase). La
// constante se consume desde `usuarios.service.ts` (validación en PATCH
// /usuarios/me), `auth/username-disponible/route.ts` y `auth/signup/route.ts`.

export const USERNAMES_RESERVADOS = new Set<string>([
  // Rutas y operación
  "admin",
  "administrator",
  "admins",
  "api",
  "auth",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "help",
  "support",
  "soporte",
  "contacto",
  "contact",
  "mail",
  "email",
  "www",
  "http",
  "https",
  "ftp",
  "smtp",

  // Roles
  "root",
  "owner",
  "superuser",
  "staff",
  "moderator",
  "mod",
  "bot",
  "system",
  "sistema",

  // Términos técnicos
  "null",
  "undefined",
  "none",
  "void",
  "anonymous",
  "anon",
  "guest",
  "user",
  "users",
  "usuario",
  "usuarios",
  "test",
  "testing",
  "demo",
  "example",

  // Marca / producto
  "habla",
  "hablaapp",
  "hablaplay",
  "hablaoficial",
  "hablaperu",
  "hablateam",
  "equipohabla",
  "habla_app",
  "habla_oficial",

  // Rutas app
  "wallet",
  "billetera",
  "perfil",
  "profile",
  "tienda",
  "shop",
  "store",
  "matches",
  "partidos",
  "torneo",
  "torneos",
  "tournament",
  "ranking",
  "premios",
  "premio",

  // Palabras comerciales
  "lukas",
  "pozo",
  "jackpot",
]);

/** Retorna true si el username (en cualquier caps) está en la lista de reservados. */
export function esReservado(username: string): boolean {
  return USERNAMES_RESERVADOS.has(username.trim().toLowerCase());
}
