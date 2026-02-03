import { useState, createContext, useContext, ReactNode, useEffect } from "react";

// Definição do Tipo de Usuário Simulado
interface User {
  id: string;
  name: string;
  email: string;
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}>({
  user: null,
  loading: false,
  signIn: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // ✅ O TRUQUE: Já iniciamos com o usuário preenchido!
  // O App vai achar que você acabou de digitar a senha correta.
  const [user, setUser] = useState<User | null>({
    id: "operador-01",
    name: "Operador da Fábrica",
    email: "producao@farinheira.com"
  });

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading: false, 
        signIn: async () => {}, // Funções vazias para não dar erro
        signOut: async () => {} 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
