import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // MUDANÇA: Agora usamos sessionStorage (apaga ao fechar a aba)
    const savedUser = sessionStorage.getItem("farinheira_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, pass: string) => {
    // Login para a fábrica: jorge / jorge123
    if (pass === "jorge123") {
      const userData = { id: "1", email, name: email.split('@')[0] };
      setUser(userData);
      // MUDANÇA: Salva na sessão
      sessionStorage.setItem("farinheira_user", JSON.stringify(userData));
      return { error: null };
    }
    return { error: { message: "Senha incorreta para a fábrica." } };
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const userData = { id: Math.random().toString(), email, name };
    setUser(userData);
    // MUDANÇA: Salva na sessão
    sessionStorage.setItem("farinheira_user", JSON.stringify(userData));
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    // MUDANÇA: Limpa a sessão
    sessionStorage.removeItem("farinheira_user");
  };

  return { user, loading, signIn, signUp, signOut };
}
