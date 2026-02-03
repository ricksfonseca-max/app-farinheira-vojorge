import { useState, createContext, useContext, ReactNode } from "react";

const AuthContext = createContext({
  user: { id: "1", name: "Operador VPS", email: "op@industria.com" },
  loading: false,
  signIn: async () => {},
  signOut: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Simula um usuário já logado
  const user = { id: "1", name: "Operador VPS", email: "op@industria.com" };
  return (
    <AuthContext.Provider value={{ user, loading: false, signIn: async()=>{}, signOut: async()=>{} }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
