// /comunidad — placeholder. La feature se construye en lotes posteriores
// (Lote 7 — comentarios y suscripción a categorías); por ahora la ruta
// existe sólo para que el item "Comunidad" del BottomNav (Lote 3) tenga
// destino válido.

export const metadata = {
  title: "Comunidad · Habla!",
  description: "Comunidad de Habla! — próximamente.",
};

export default function ComunidadPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center md:px-6 md:py-28">
      <span aria-hidden className="text-[56px] leading-none">
        💬
      </span>
      <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark md:text-[48px]">
        Comunidad
      </h1>
      <p className="max-w-md text-base leading-relaxed text-muted-d">
        Próximamente. Acá vas a poder comentar, debatir y suscribirte a las
        categorías que te interesan.
      </p>
    </div>
  );
}
