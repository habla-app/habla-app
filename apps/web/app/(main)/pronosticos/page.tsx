// /pronosticos — placeholder. La feature se construye en lotes
// posteriores; por ahora la ruta existe sólo para que el item
// "Pronósticos" del BottomNav (Lote 3) tenga destino válido.

export const metadata = {
  title: "Pronósticos · Habla!",
  description: "Pronósticos de la comunidad — próximamente.",
};

export default function PronosticosPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center md:px-6 md:py-28">
      <span aria-hidden className="text-[56px] leading-none">
        🎯
      </span>
      <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark md:text-[48px]">
        Pronósticos
      </h1>
      <p className="max-w-md text-base leading-relaxed text-muted-d">
        Próximamente. Acá vas a encontrar pronósticos de la comunidad y de
        nuestros editores.
      </p>
    </div>
  );
}
