import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { AuthForm } from "@/components/AuthForm";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { MoistureTrends } from "@/components/MoistureTrends";
import { Header } from "@/components/Header";
import { Loader2, ListChecks, BarChart3, LayoutDashboard } from "lucide-react";

export default function Index() {
  const { user, loading: authLoading, logout } = useAuth();
  
  // Pegamos o refetch (função que recarrega a tabela)
  const { records, isLoading, refetch } = useProductionRecords();
  
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');

  // --- O SEGREDO ESTÁ AQUI ---
  const handleFormSuccess = () => {
    // 1. Atualiza imediatamente (Tenta sorte)
    refetch();
    
    // 2. Atualiza de novo após 500ms (Garante que o MySQL terminou de gravar)
    setTimeout(() => {
      console.log("Atualizando tabela (Delay de segurança)...");
      refetch();
    }, 500);
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#020817]"><Loader2 className="animate-spin text-emerald-500 h-12 w-12"/></div>;
  if (!user) return <AuthForm />;

  return (
    // FUNDO PRINCIPAL ESCURO
    <div className="min-h-screen bg-[#020817] text-slate-200 pb-10 font-sans selection:bg-emerald-500/30">
      <Header user={user} onLogout={logout} />
      
      <main className="container mx-auto px-4 py-6 max-w-[95%]">
        {/* Menu de Abas SCADA */}
        <div className="flex items-center gap-4 mb-6 border-b border-slate-800 pb-1">
          <button onClick={() => setActiveTab('registros')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'registros' ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <LayoutDashboard size={18} /> PAINEL
          </button>
          <button onClick={() => setActiveTab('graficos')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'graficos' ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <BarChart3 size={18} /> GRÁFICOS
          </button>
        </div>

        {activeTab === 'registros' && (
           <div className="animate-in fade-in duration-500 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               {/* Formulário (Esquerda) */}
               <div className="lg:col-span-4 xl:col-span-3">
                 <div className="sticky top-4">
                   <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden p-1">
                     <ProductionForm onSubmit={handleFormSuccess} />
                   </div>
                 </div>
               </div>

               {/* Tabela (Direita) */}
               <div className="lg:col-span-8 xl:col-span-9">
                  {isLoading ? (
                    <div className="bg-slate-900 p-20 text-center rounded-xl shadow-2xl border border-slate-800">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-500 mb-2" />
                      <p className="text-slate-400">Carregando dados da planta...</p>
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden">
                      <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                        <h3 className="font-bold text-slate-200 flex gap-2"><ListChecks className="text-emerald-500"/> Histórico Recente</h3>
                        <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-1 rounded font-mono border border-slate-700">{records.length} registros</span>
                      </div>
                      <ProductionTable records={records} />
                    </div>
                  )}
               </div>
           </div>
        )}

        {activeTab === 'graficos' && (
           <div className="animate-in fade-in duration-500 max-w-5xl mx-auto bg-slate-900 rounded-xl shadow-2xl border border-slate-800 p-4">
             <MoistureTrends records={records} />
           </div>
        )}
      </main>
    </div>
  );
}
