"use client";

export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-brand-border bg-brand-blue-dark/97 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 font-display text-[26px] font-black text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold text-sm font-black text-black">
          H
        </span>
        Habla!
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded-lg bg-brand-gold px-4 py-1.5 text-[13px] font-bold text-black transition-colors hover:bg-brand-gold-light">
          Entrar
        </button>
      </div>
    </nav>
  );
}
