import { useState, createContext, useContext, ReactNode, useEffect } from "react";
import { toast } from "@/components/ui/use-toast"; // ou o caminho correto do seu toast

// A URL do seu Backend
const API_BASE = "https://nodered-v2.fsk.tec.br/api";

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (nome: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Tentar recuperar usuário salvo no localStorage ao abrir o app
  useEffect(() => {
    const savedUser = localStorage.getItem("@Farinheira:User");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // 2. Função de Login Real
  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: pass }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Sucesso!
        const userData = {
            id: data.user.id,
            name: data.user.nome,
            email: data.user.email
        };
        setUser(userData);
        localStorage.setItem("@Farinheira:User", JSON.stringify(userData));
        toast({ title: "Bem-vindo!", className: "bg-green-600 text-white" });
      } else {
        toast({ title: "Erro", description: "Email ou senha incorretos", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro de Conexão", description: "O servidor Node-RED não respondeu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 3. Função de Cadastro Real
  const signUp = async (nome: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha: pass }),
      });

      if (response.ok) {
        toast({ title: "Conta criada!", description: "Faça login agora." });
        return true;
      } else {
        toast({ title: "Erro ao cadastrar", variant: "destructive" });
        return false;
      }
    } catch (error) {
        toast({ title: "Erro de Conexão", variant: "destructive" });
        return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("@Farinheira:User");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
