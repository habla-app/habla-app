// Layout del panel de administracion
// Solo accesible para usuarios con rol ADMIN
// TODO: Sprint 7 - Implementar layout admin con verificacion de rol
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* TODO: Sidebar admin con navegacion */}
      <main className="p-8">{children}</main>
    </div>
  );
}
