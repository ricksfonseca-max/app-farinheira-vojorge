import { User } from "lucide-react";
import { MARCA } from "@/config/marca";

// Faixa clara com a logo + listras vermelha e verde, como a faixa da marca.
export function Header() {
  return (
    <header className="relative z-50 shadow-2xl">
      <div className="bg-creme">
        <div className="container mx-auto flex max-w-[95%] items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img src={MARCA.logo} alt={MARCA.nome} className="h-12 w-auto shrink-0 sm:h-16" />
            <div className="flex min-w-0 flex-col border-l-2 border-mandioca-200 pl-3 leading-none sm:pl-4">
              <span className="truncate text-sm font-black uppercase tracking-tight text-marca-700 sm:text-xl">
                {MARCA.titulo}
              </span>
              <span className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-cereja-600 sm:text-[11px]">
                {MARCA.subtitulo}
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-mandioca-200 bg-white px-3 py-1.5 sm:flex">
            <User className="h-4 w-4 text-marca-600" />
            <span className="text-sm font-semibold text-mata-700">Acesso livre</span>
          </div>
        </div>
      </div>
      <div className="h-1 bg-cereja-500" />
      <div className="h-1.5 bg-marca-600" />
    </header>
  );
}
