import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tenta recuperar do localStorage (que é permanente)
    try {
      const savedUser = localStorage.getItem("farinheira_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Erro ao carregar usuário salvo", e);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    // IMPORTANTE: A senha definida no código é jorge123
    if (pass === "jorge123") {
      const userData = { 
        id: "1", 
        email: email.toLowerCase(), 
        name: email.split('@')[0] 
      };
      
      setUser(userData);
      // Salva no localStorage para não pedir login ao voltar
      localStorage.setItem("farinheira_user", JSON.stringify(userData));
      return { error: null };
    }
    
    return { error: { message: "Senha incorreta. Use a senha padrão da fábrica." } };
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const userData = { id: Math.random().toString(), email, name };
    setUser(userData);
    localStorage.setItem("farinheira_user", JSON.stringify(userData));
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem("farinheira_user");
  };

  return { user, loading, signIn, signUp, signOut };
}
