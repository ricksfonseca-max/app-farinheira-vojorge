import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { AuthForm } from "@/components/AuthForm";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable"; // Certifique-se que este arquivo existe
import { Header } from "@/components/Header";
import { Loader2, ListChecks } from "lucide-react";

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        <p className="mt-4 font-black text-slate-700 uppercase tracking-widest">Vô Jorge - Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} onLogout={signOut} />
      
      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Seção de Entrada: Formulário */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ProductionForm onSubmit={addRecord} />
        </section>

        {/* Seção de Visualização: Tabela de Registros */}
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center gap-2 px-1 text-slate-700">
            <ListChecks className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-bold uppercase tracking-tight">Histórico de Produção</h2>
          </div>

          {recordsLoading ? (
            <div className="bg-white p-12 rounded-3xl shadow-inner border border-slate-100 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mb-2" />
              <p className="text-sm font-medium text-slate-400">Consultando MySQL...</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <ProductionTable 
                records={records} 
                onDelete={deleteRecord} 
              />
            </div>
          )}
        </section>
      </main>

      <footer className="py-8 text-center border-t border-slate-200 mt-12">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} Indústria Vô Jorge LTDA - Tecnologia fsk.tec.br
        </p>
      </footer>
    </div>
  );
}
