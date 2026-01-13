import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { AuthForm } from "@/components/AuthForm";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { MoistureTrends } from "@/components/MoistureTrends"; // <--- NOVO IMPORT
import { Header } from "@/components/Header";
import { Loader2, ListChecks, BarChart3 } from "lucide-react"; // <--- NOVO ICONE

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();
  
  // Estado para controlar as Abas
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        <p className="mt-4 font-black text-slate-700 uppercase tracking-widest">Carregando Vô Jorge...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header user={user} onLogout={signOut} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        
        {/* BOTÕES DAS ABAS (NAVEGAÇÃO) */}
        <div className="flex items-center justify-center p-1 bg-slate-200/50 rounded-xl w-full max-w-md mx-auto mb-6">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'registros' 
                ? "bg-white text-green-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ListChecks size={18} />
            REGISTROS
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'graficos' 
                ? "bg-white text-green-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
            }`}
          >
            <BarChart3 size={18} />
            GRÁFICOS
          </button>
        </div>

        {/* CONTEÚDO DA ABA: REGISTROS */}
        {activeTab === 'registros' && (
           <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* O Formulário só aparece na aba de registros para não poluir o gráfico */}
             <ProductionForm onSubmit={addRecord} />

             {recordsLoading ? (
                <div className="bg-white p-12 rounded-3xl shadow-inner border border-slate-100 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600 mb-2" />
                  <p className="text-sm font-medium text-slate-400">Atualizando dados...</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                  <ProductionTable 
                    records={records} 
                    onDelete={deleteRecord} 
                  />
                </div>
              )}
           </div>
        )}

        {/* CONTEÚDO DA ABA: GRÁFICOS */}
        {activeTab === 'graficos' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <MoistureTrends records={records} />
           </div>
        )}

      </main>

      <footer className="py-6 text-center border-t border-slate-200 mt-8">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} Indústria Vô Jorge - Sistema de Qualidade
        </p>
      </footer>
    </div>
  );
}
