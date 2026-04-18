// Middleware de rutas protegidas.
// Rutas publicas: /, /torneos, /torneo/[id], /tienda (NO tocar).
// Rutas que requieren login: /wallet, /perfil, /admin.
// /admin ademas requiere rol ADMIN.

import { auth } from "@/lib/auth";

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

  // /wallet y /perfil: requieren login, pero cualquier rol.
  if (!isLoggedIn) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/wallet/:path*",
    "/perfil/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
