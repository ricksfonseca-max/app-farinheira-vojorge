import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

interface User {
  name: string;
  email: string;
  token?: string;
}

// URL base do Node-RED
const API_BASE = "https://nodered-vojorge.fsk.tec.br/api/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Recuperar sessão ao abrir
  useEffect(() => {
    const savedUser = localStorage.getItem("vj_user_session");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("vj_user_session");
      }
    }
    setLoading(false);
  }, []);

  // LOGIN
  const signIn = async (email: string, senha: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erro ao entrar");

      // 1. Salva a sessão
      localStorage.setItem("vj_user_session", JSON.stringify(data.user));
      setUser(data.user);
      
      toast({ 
        title: `Bem-vindo, ${data.user.name}!`,
        className: "bg-green-600 text-white border-none"
      });

      // 2. TRUQUE DE MESTRE: Recarrega a página após 1 segundo para entrar no sistema
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // CADASTRO
  const signUp = async (nome: string, email: string, senha: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Erro ao cadastrar");

      toast({ 
        title: "Conta criada com sucesso!", 
        description: "Faça login para entrar.",
        className: "bg-green-600 text-white border-none" 
      });
      
      return true;
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("vj_user_session");
    setUser(null);
    window.location.reload(); // Recarrega ao sair também
  };

  return { user, loading, signIn, signUp, signOut };
}
