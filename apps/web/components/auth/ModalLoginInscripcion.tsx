"use client";

// Modal contextual que se dispara cuando un usuario sin sesión intenta
// inscribirse a un torneo. Lote 2 (Abr 2026): se demolió el sistema de
// Lukas — sin pozo, sin entrada, sin bonus. El modal queda como CTA puro
// "Únete a Habla!" + redirección a /auth/signin con callbackUrl al torneo.

import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, Button } from "@/components/ui";

interface Torneo {
  id?: string;
  nombre: string;
  partido: { equipoLocal: string; equipoVisita: string };
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
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
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
          Registrate gratis y armá tu predicción para subir en el ranking.
        </p>

        {torneo && (
          <div className="mb-5 rounded-md border border-light bg-card p-4 text-center shadow-sm">
            <div className="font-display text-base font-extrabold uppercase text-dark">
              {torneo.partido.equipoLocal} vs {torneo.partido.equipoVisita}
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
