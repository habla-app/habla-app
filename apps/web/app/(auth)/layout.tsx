// Layout para rutas de autenticacion (login/registro)
// Sin sidebar ni header principal
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-habla-dark">
      {children}
    </div>
  );
}
