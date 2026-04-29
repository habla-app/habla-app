// Middleware unificado — Lote 1 agrega rate limiting sobre el middleware
// de auth preexistente.
//
// DOS RESPONSABILIDADES:
//   1) Rate limiting para rutas /api/* (con tiers por endpoint).
//   2) Protección de rutas autenticadas: /perfil, /mis-combinadas, /admin.
//      Más el redirect a /auth/completar-perfil si el usuario está
//      logueado pero sin @handle definitivo (Abr 2026).
//
// La rama de rate-limit retorna antes de entrar a la lógica de auth, por
// lo que las rutas /api/* nunca ejecutan `auth()` aquí — los route
// handlers llaman `auth()` ellos mismos cuando necesitan sesión.
//
// Rutas públicas (sin login): /, /torneos, /torneo/[id], /matches,
// /live-match, /pronosticos, /comunidad. NO se listan en el matcher.
//
// Registro formal (Abr 2026): si el usuario está logueado pero con
// `usernameLocked=false` (OAuth primera vez), redirect a
// /auth/completar-perfil.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkLimit } from "@/lib/rate-limit";

// Exportada para test de regresión (auth-protection.test.ts).
//
// IMPORTANTE: Next.js parsea este archivo con un parser estático que NO
// soporta spread (`[...PROTECTED_MATCHERS]`) en `config.matcher`. La lista
// se duplica literal en `config.matcher` abajo — el test valida que no
// driften entre sí.
export const PROTECTED_MATCHERS = [
  "/perfil/:path*",
  "/mis-combinadas/:path*",
  "/admin",
  "/admin/:path*",
] as const;

// -----------------------------------------------------------------------
// Rate limiting
// -----------------------------------------------------------------------
//
// Ventana de 1 minuto para todos los tiers. Los límites son por-IP salvo
// los endpoints autenticados, que son por-usuario (fallback a IP si no
// hay sesión identificable).

const WINDOW_MS = 60_000;

const RATE_TIERS = {
  // /api/auth/* — subido a 30/min (Mini-lote 7.6). NextAuth v5 con
  // useSession() golpea /api/auth/session en cada mount + window-focus
  // y /api/auth/csrf en cada flujo OAuth: 10/min era suficiente para
  // login/logout aislado pero se quedaba corto en navegación normal,
  // dando 429 silenciosos al hacer signOut() y dejando la cookie sin
  // borrar (logout aparentemente "no responde").
  AUTH: 30,
  CRITICAL: 30, // tickets, torneo inscribir (por usuario)
  DEFAULT: 60, // resto /api/*
} as const;

function ipFromRequest(req: NextRequest): string {
  // Cloudflare + Railway añaden estos headers. `x-forwarded-for` es una
  // lista separada por comas; tomamos el primero (cliente original).
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function getRateLimitConfig(
  pathname: string,
): { limit: number; keyPrefix: string; perUser: boolean } | null {
  // Webhooks: sin límite por IP (entran de IPs fluctuantes — se
  // protegen con firma HMAC en el handler, no aquí).
  if (pathname.startsWith("/api/v1/webhooks/") || pathname.startsWith("/api/webhooks/")) {
    return null;
  }

  // Health: excluido — Uptime Robot lo golpea cada 5 min + checks
  // internos de Railway.
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return null;
  }

  // Debug: excluido (ya tiene guard por token).
  if (pathname.startsWith("/api/debug/")) return null;

  // Signout: NUNCA rate-limiteamos (Mini-lote 7.6). Si el usuario quiere
  // cerrar sesión, debe poder siempre. Un 429 acá deja la cookie sin
  // borrar y se rompe la UX (botón "no responde", luego loop a OAuth y
  // lockout de Google). Cubre tanto GET (NextAuth pre-form) como POST.
  if (pathname === "/api/auth/signout") return null;

  // Auth endpoints: tier AUTH (30/min).
  if (pathname.startsWith("/api/auth/")) {
    return { limit: RATE_TIERS.AUTH, keyPrefix: "auth", perUser: false };
  }

  // Endpoints críticos de negocio: tier CRITICAL (30/min por usuario).
  if (
    pathname.startsWith("/api/v1/tickets") ||
    /^\/api\/v1\/torneos\/[^/]+\/inscribir/.test(pathname)
  ) {
    return { limit: RATE_TIERS.CRITICAL, keyPrefix: "critical", perUser: true };
  }

  // Resto de /api/*: tier DEFAULT (60/min por IP).
  if (pathname.startsWith("/api/")) {
    return { limit: RATE_TIERS.DEFAULT, keyPrefix: "default", perUser: false };
  }

  return null;
}

async function applyRateLimit(
  req: NextRequest,
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  const cfg = getRateLimitConfig(pathname);
  if (!cfg) return null;

  let subject = ipFromRequest(req);
  if (cfg.perUser) {
    try {
      const session = await auth();
      if (session?.user?.id) subject = `u:${session.user.id}`;
    } catch {
      // Si auth() revienta, caemos a IP — mejor algo de protección que
      // ninguna.
    }
  }

  const key = `${cfg.keyPrefix}:${subject}`;
  const result = checkLimit(key, cfg.limit, WINDOW_MS);
  if (result.ok) return null;

  return new NextResponse(
    JSON.stringify({
      error: {
        code: "RATE_LIMITED",
        message: "Demasiadas solicitudes. Reintenta en unos segundos.",
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

// -----------------------------------------------------------------------
// Auth gating (código original preservado)
// -----------------------------------------------------------------------

export default auth(async (req) => {
  // Rate limit primero (solo aplica a /api/* — retorna null para todo
  // lo demás). En /api/* retornamos sin tocar la lógica de auth.
  const rateResponse = await applyRateLimit(req as unknown as NextRequest);
  if (rateResponse) return rateResponse;

  const pathname = req.nextUrl.pathname;

  // /api/* no cae al gating de auth — los handlers llaman auth() ellos
  // mismos si necesitan sesión.
  if (pathname.startsWith("/api/")) return;

  const isLoggedIn = !!req.auth;
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

  // /perfil, /mis-combinadas: requieren login + username definitivo.
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
  // Lote 1: agregamos /api/:path* para rate limiting (auth gating skippea
  // /api/* en el handler arriba).
  matcher: [
    "/perfil/:path*",
    "/mis-combinadas/:path*",
    "/admin",
    "/admin/:path*",
    "/api/:path*",
  ],
};
