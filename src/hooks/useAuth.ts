import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const savedUser = sessionStorage.getItem("farinheira_user");
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.error("Erro na sessão", e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (pass === "jorge123") {
      const userData = { id: "1", email, name: email.split('@')[0] };
      sessionStorage.setItem("farinheira_user", JSON.stringify(userData));
      setUser(userData);
      // O reload garante que o Index.tsx perceba a mudança
      window.location.href = "/"; 
      return { error: null };
    }
    return { error: { message: "Senha incorreta (use jorge123)" } };
  };

  const signOut = () => {
    sessionStorage.removeItem("farinheira_user");
    window.location.href = "/";
  };

  return { user, loading, signIn, signOut };
}
