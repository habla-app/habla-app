"use client";

// Modal contextual que se dispara cuando un usuario sin sesión intenta
// inscribirse a un torneo. Muestra info del torneo (motivacional) y
// redirige a /auth/login con callbackUrl al torneo.
//
// Se conecta con el flujo de inscripción en el Sub-Sprint 3 (match cards
// + `/torneo/:id`). Usa el Modal primitive con header dorado + body light.
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, Button } from "@/components/ui";

interface Torneo {
  id?: string;
  nombre: string;
  partido: { equipoLocal: string; equipoVisita: string };
  entradaLukas: number;
  pozoBruto: number;
}

interface ModalLoginInscripcionProps {
  isOpen: boolean;
  onClose: () => void;
  torneo: Torneo | null;
}

export function ModalLoginInscripcion({
  isOpen,
  onClose,
  torneo,
}: ModalLoginInscripcionProps) {
  const router = useRouter();

  const irALogin = () => {
    const callbackUrl = torneo?.id ? `/torneo/${torneo.id}` : "/";
    router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Únete a Habla!" maxWidth="480px">
      <ModalHeader
        onClose={onClose}
        eyebrow={torneo?.nombre ?? "Inscripción"}
      >
        <h2 className="font-display text-[26px] font-black uppercase tracking-wide text-white">
          ¡Únete a Habla!
        </h2>
      </ModalHeader>
      <ModalBody className="text-center">
        <p className="mb-5 text-sm leading-relaxed text-body">
          Regístrate y recibe{" "}
          <span className="font-bold text-brand-gold-dark">500 Lukas</span> de
          regalo para tu primera combinada.
        </p>

        {torneo && (
          <div className="mb-5 rounded-md border border-light bg-card p-4 text-left shadow-sm">
            <div className="mb-2 font-display text-base font-extrabold uppercase text-dark">
              {torneo.partido.equipoLocal} vs {torneo.partido.equipoVisita}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-d">
                  Pozo
                </div>
                <div className="font-display text-lg font-black leading-none text-brand-gold-dark">
                  {torneo.pozoBruto.toLocaleString("es-PE")}{" "}
                  <span aria-hidden>🪙</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-d">
                  Entrada
                </div>
                <div className="font-display text-lg font-black leading-none text-dark">
                  {torneo.entradaLukas} <span aria-hidden>🪙</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <Button variant="primary" size="xl" onClick={irALogin}>
          Continuar con email
        </Button>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-d">
          Al registrarte aceptas los{" "}
          <span className="font-semibold text-brand-blue-main">Términos</span> ·
          Mayores de 18 años
        </p>
      </ModalBody>
    </Modal>
  );
}
