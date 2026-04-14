// Layout principal para usuarios autenticados
// Incluye Header, Sidebar/Nav y Footer
// TODO: Sprint 1 - Implementar layout con navegacion
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-habla-dark text-white">
      {/* TODO: Header con balance de Lukas */}
      <main className="container mx-auto px-4 py-8">{children}</main>
      {/* TODO: Footer con navegacion mobile */}
    </div>
  );
}
