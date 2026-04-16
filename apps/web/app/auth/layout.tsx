// Layout para rutas de autenticacion (login / verificar / error).
// Standalone: sin NavBar ni BottomNav. Solo fondo azul oscuro y contenido centrado.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-blue-dark px-4 text-brand-text">
      {children}
    </div>
  );
}
