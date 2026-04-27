// Banner de modo PREVIEW para vistas admin de contabilidad — Lote 8 §2.F.
// Aparece arriba del contenido siempre que `pagosHabilitados()===false`.
// Se renderiza server-side; el caller pasa `enabled` como prop para evitar
// mismatch SSR/CSR.

export function PreviewBanner({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <div className="mb-5 rounded-md border-2 border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
      <strong className="font-bold">⚠️ MODO PREVIEW —</strong>{" "}
      datos descartables, no representan operación real. El flag{" "}
      <code className="rounded bg-yellow-100 px-1">PAGOS_HABILITADOS</code>{" "}
      está en <strong>false</strong>. Para limpiar antes del flip a producción,
      usar <code className="rounded bg-yellow-100 px-1">POST /admin/contabilidad/reset-preview</code>.
    </div>
  );
}
