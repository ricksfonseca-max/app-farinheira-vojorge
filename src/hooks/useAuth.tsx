import { createContext, useContext } from 'react';
const AuthContext = createContext<any>({ 
  user: { email: 'operador@farinheira.local' }, 
  loading: false, 
  logout: () => console.log("Sessão contínua.") 
});
export function AuthProvider({ children }: any) {
  return <AuthContext.Provider value={{ user: { email: 'operador@farinheira.local' }, loading: false, logout: () => {} }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
