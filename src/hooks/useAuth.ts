import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tenta recuperar da SESSÃO (apaga ao fechar a aba/navegador)
    try {
      const savedUser = sessionStorage.getItem("farinheira_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error("Erro ao carregar sessão", e);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    // Validação da senha da fábrica
    if (pass === "jorge123") {
      const userData = { 
        id: "1", 
        email: email.toLowerCase(), 
        name: email.split('@')[0] 
      };
      
      // Salva na sessão
      sessionStorage.setItem("farinheira_user", JSON.stringify(userData));
      
      // FORÇA O RECARREGAMENTO: Isso resolve o problema de "não ir a lugar algum"
      window.location.reload();
      
      return { error: null };
    }
    
    return { error: { message: "Senha incorreta. Use jorge123" } };
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const userData = { id: Math.random().toString(), email, name };
    sessionStorage.setItem("farinheira_user", JSON.stringify(userData));
    window.location.reload();
    return { error: null };
  };

  const signOut = async () => {
    sessionStorage.removeItem("farinheira_user");
    window.location.reload(); // Volta para o login imediatamente
  };

  return { user, loading, signIn, signUp, signOut };
}
