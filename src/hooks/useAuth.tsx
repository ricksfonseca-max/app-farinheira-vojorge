import { useState, useEffect, createContext, useContext } from "react";
import { toast } from "@/components/ui/use-toast";

// 🔗 APONTA PARA SEU NODE-RED V3
const API_URL = "https://nodered-vojorge.fsk.tec.br/api";

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, senha: string) => Promise<void>;
  signUp: (nome: string, email: string, senha: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tenta recuperar o usuário salvo no navegador
    const savedUser = localStorage.getItem("fsk_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // --- FUNÇÃO DE LOGIN (ENTRAR) ---
  const signIn = async (email: string, senha: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      if (!res.ok) throw new Error("Email ou senha incorretos");

      const data = await res.json();
      const userData = data.user;
      
      setUser(userData);
      localStorage.setItem("fsk_user", JSON.stringify(userData));
      
      toast({ 
        title: "Acesso Permitido", 
        description: `Bem-vindo à Fábrica, ${userData.name}.`,
        className: "bg-green-600 text-white border-none"
      });
      
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erro de Acesso", 
        description: "Verifique suas credenciais." 
      });
      throw error;
    }
  };

  // --- FUNÇÃO DE CADASTRO (CRIAR CONTA) ---
  const signUp = async (nome: string, email: string, senha: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      if (!res.ok) throw new Error("Erro ao cadastrar");

      toast({ 
        title: "Conta Criada!", 
        description: "Agora faça login com sua nova senha.",
        className: "bg-blue-600 text-white border-none"
      });
      return true;

    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erro no Cadastro", 
        description: "Tente novamente mais tarde." 
      });
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("fsk_user");
    toast({ title: "Desconectado", description: "Até logo!" });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
