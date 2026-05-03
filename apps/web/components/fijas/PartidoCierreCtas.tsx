"use client";
// PartidoCierreCtas — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail (.partido-cierre-ctas).
//
// Mockup line 3043-3047: dos botones uno arriba del otro (no grid),
// segundo varía según auth (.not-socios-only vs .socios-only).

import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";

interface Props {
  partidoSlug: string;
}

export function PartidoCierreCtas({ partidoSlug }: Props) {
  return (
    <div className="partido-cierre-ctas">
      <Link
        href={`/liga/${partidoSlug}?modal=1`}
        className="btn btn-primary btn-block"
      >
        🏆 Armá tu combinada en la Liga
      </Link>
      <AuthGate state={["visitor", "free"]}>
        <Link href="/socios" className="btn btn-secondary btn-block">
          💎 Conocer Socios
        </Link>
      </AuthGate>
      <AuthGate state="socios">
        <Link href="/socios-hub" className="btn btn-secondary btn-block">
          💎 Ir a mi hub Socios
        </Link>
      </AuthGate>
    </div>
  );
}
