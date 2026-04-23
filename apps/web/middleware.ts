// Middleware de rutas protegidas.
// Rutas públicas: /, /torneos, /torneo/[id], /tienda (NO tocar).
// Rutas que requieren login: /wallet, /perfil, /mis-combinadas, /admin.
// /admin además requiere rol ADMIN.
//
// Registro formal (Abr 2026): si el usuario está logueado pero con
// `usernameLocked=false` (OAuth primera vez sin haber elegido @handle),
// lo redirigimos a /auth/completar-perfil antes de dejarlo entrar.
//
// Bug #3 Hotfix (Sub-Sprint 5): /mis-combinadas se incluye en el matcher
// porque antes el RSC redirigía via auth() dejando una ventana de race
// condition con cookie no propagada. El middleware re-evalúa por request
// consistentemente.

import { auth } from "@/lib/auth";

// Exportada para test de regresión (auth-protection.test.ts).
//
// IMPORTANTE: Next.js parsea este archivo con un parser estático que NO
// soporta spread (`[...PROTECTED_MATCHERS]`) en `config.matcher`. La lista
// se duplica literal en `config.matcher` abajo — el test valida que no
// driften entre sí.
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
  const session = req.auth;

  const isAdmin = pathname.startsWith("/admin");
  const userRol = session?.user?.rol;
  const usernameLocked = session?.user?.usernameLocked ?? false;

  // /admin: requiere login + rol ADMIN.
  if (isAdmin) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/auth/signin", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return Response.redirect(loginUrl);
    }
    if (userRol !== "ADMIN") {
      return Response.redirect(new URL("/", req.url));
    }
    // Aunque sea admin, si no completó su @handle, lo mandamos a completar.
    if (!usernameLocked) {
      const completarUrl = new URL("/auth/completar-perfil", req.url);
      completarUrl.searchParams.set("callbackUrl", pathname);
      return Response.redirect(completarUrl);
    }
    return;
  }

  // /wallet, /perfil, /mis-combinadas: requieren login + username definitivo.
  if (!isLoggedIn) {
    const loginUrl = new URL("/auth/signin", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  if (!usernameLocked) {
    const completarUrl = new URL("/auth/completar-perfil", req.url);
    completarUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(completarUrl);
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
