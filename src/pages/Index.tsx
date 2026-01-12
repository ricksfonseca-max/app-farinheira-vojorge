import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import { ProductionForm } from "@/components/ProductionForm";
import { Header } from "@/components/Header";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, loading, signOut } = useAuth();

  // 1. Se estiver carregando, mostra o logo da Vô Jorge
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        <p className="mt-4 font-bold text-slate-600">Iniciando Sistema...</p>
      </div>
    );
  }

  // 2. Se NÃO tem usuário, obriga o Login
  if (!user) {
    return <AuthForm />;
  }

  // 3. Se TEM usuário, mostra a tela de Produção Verde
  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} onLogout={signOut} />
      <main className="container mx-auto px-4 py-8">
        <ProductionForm onSubmit={(data) => console.log("Salvo:", data)} />
        
        {/* Aqui você pode colocar a ProductionTable depois */}
        <div className="mt-10 text-center text-slate-400 text-sm">
          Logado como: {user.email} | Indústria Vô Jorge LTDA
        </div>
      </main>
    </div>
  );
}
