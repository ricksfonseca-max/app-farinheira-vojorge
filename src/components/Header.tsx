import { LogOut, Factory, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  user: { name: string; email: string };
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-green-700 text-white shadow-lg border-b border-green-800">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        {/* Lado Esquerdo: Logo da Fábrica */}
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <Factory className="h-6 w-6 text-green-100" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black tracking-tighter text-lg uppercase">Indústria Vô Jorge</span>
            <span className="text-[10px] uppercase tracking-widest text-green-200">Farinheira</span>
          </div>
        </div>

        {/* Lado Direito: Usuário e Sair */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-green-800/50 px-3 py-1.5 rounded-xl border border-white/10">
            <User className="h-4 w-4 text-green-300" />
            <span className="text-sm font-semibold truncate max-w-[120px]">
              {user.name || user.email.split('@')[0]}
            </span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout}
            className="text-white hover:bg-red-600 hover:text-white rounded-xl transition-all font-bold px-4"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
