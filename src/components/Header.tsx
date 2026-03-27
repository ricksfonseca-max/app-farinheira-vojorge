import { LogOut, Factory, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  user: { name: string; email: string };
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    // z-50 garante que o botão Sair nunca fique bloqueado por outros elementos
    <header className="bg-slate-900/90 backdrop-blur-md text-slate-200 shadow-2xl border-b border-slate-800 relative z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-[95%]">
        {/* Lado Esquerdo: Logo da Fábrica */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Factory className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black tracking-tight text-xl text-slate-100 uppercase">Planta Vô Jorge</span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400 font-bold mt-1">CCO Farinheira</span>
          </div>
        </div>

        {/* Lado Direito: Usuário e Sair */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-[#020817] px-3 py-1.5 rounded-lg border border-slate-800">
            <User className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-300 truncate max-w-[150px]">
              {user?.name || user?.email?.split('@')[0] || "Operador"}
            </span>
          </div>
          
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={onLogout}
            className="border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-600 hover:border-rose-600 hover:text-white rounded-lg transition-all font-bold px-4 h-9"
          >
            <LogOut className="h-4 w-4 mr-2" />
            DESCONECTAR
          </Button>
        </div>
      </div>
    </header>
  );
}
