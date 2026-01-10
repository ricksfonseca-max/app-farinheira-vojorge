import { Wheat } from "lucide-react";
import { ReactNode } from "react";

interface HeaderProps {
  children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-secondary rounded-full p-3">
            <Wheat className="w-8 h-8 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Farinheira Vô Jorge
            </h1>
            <p className="text-primary-foreground/80 text-sm">
              Sistema de Controle de Produção
            </p>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}
