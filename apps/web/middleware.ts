// Middleware de rutas protegidas.
// Rutas publicas: /, /torneos, /torneo/[id], /tienda (NO tocar).
// Rutas que requieren login: /wallet, /perfil, /mis-combinadas, /admin.
// /admin ademas requiere rol ADMIN.
//
// Hotfix post-Sub-Sprint 5 (Bug #3): /mis-combinadas se agrega al matcher.
// Antes la página redirigía via `auth()` en el Server Component, lo que
// dejaba al usuario en una ventana donde el RSC podía evaluar la sesión
// con un cookie aún no propagado y mandarlo a /auth/login. El middleware
// re-evalúa por request usando el wrapper `auth()` de NextAuth (que parsea
// el cookie consistentemente) y redirige antes de tocar el RSC.

import { auth } from "@/lib/auth";

// Exportada para test de regresión que asegura que /mis-combinadas
// siempre quede protegida por el middleware (Bug #3).
//
// IMPORTANTE: Next.js parsea el archivo `middleware.ts` con un parser
// estático que NO soporta spread (`[...PROTECTED_MATCHERS]`) en
// `config.matcher`. Por eso la lista se duplica abajo en `config.matcher`
// como literal — el test `auth-protection.test.ts` valida que ambas
// listas no driftan entre sí.
export const PROTECTED_MATCHERS = [
  "/wallet/:path*",
  "/perfil/:path*",
  "/mis-combinadas/:path*",
  "/admin",
  "/admin/:path*",
] as const;

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const isAdmin = pathname.startsWith("/admin");
  const userRol = req.auth?.user?.rol;

  // /admin: rol ADMIN obligatorio. Si no esta logueado o no es admin, redirigir.
  if (isAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return Response.redirect(loginUrl);
    }
    if (userRol !== "ADMIN") {
      return Response.redirect(new URL("/", req.url));
    }
    return;
  }

  // /wallet, /perfil, /mis-combinadas: requieren login, pero cualquier rol.
  if (!isLoggedIn) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  // Lista literal — Next.js no acepta spread aquí (parser estático).
  // Mantener en sync con PROTECTED_MATCHERS arriba.
  matcher: [
    "/wallet/:path*",
    "/perfil/:path*",
    "/mis-combinadas/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
