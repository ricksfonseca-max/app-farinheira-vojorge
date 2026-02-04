import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords"; // Hook atualizado
import { AuthForm } from "@/components/AuthForm";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { MoistureTrends } from "@/components/MoistureTrends";
import { Header } from "@/components/Header";
import { Loader2, ListChecks, BarChart3, LayoutDashboard } from "lucide-react";

export default function Index() {
  const { user, loading: authLoading, logout } = useAuth();
  
  // Agora pegamos o 'refetch' daqui
  const { records, isLoading, refetch } = useProductionRecords();
  
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');

  // Função que será chamada quando o formulário salvar com sucesso
  const handleFormSuccess = () => {
    console.log("Registro salvo! Atualizando tabela...");
    refetch(); // <--- ATUALIZA A TABELA INSTANTANEAMENTE
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin"/></div>;
  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <Header user={user} onLogout={logout} />
      
      <main className="container mx-auto px-4 py-6 max-w-[95%]">
        {/* ABAS */}
        <div className="flex items-center gap-4 mb-6 border-b border-slate-200 pb-1">
          <button onClick={() => setActiveTab('registros')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'registros' ? "border-green-600 text-green-700 bg-green-50" : "border-transparent text-slate-500"}`}>
            <LayoutDashboard size={18} /> PAINEL
          </button>
          <button onClick={() => setActiveTab('graficos')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'graficos' ? "border-green-600 text-green-700 bg-green-50" : "border-transparent text-slate-500"}`}>
            <BarChart3 size={18} /> GRÁFICOS
          </button>
        </div>

        {activeTab === 'registros' && (
           <div className="animate-in fade-in duration-500 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               {/* FORMULÁRIO */}
               <div className="lg:col-span-4 xl:col-span-3">
                 <div className="sticky top-4">
                   {/* Passamos a função de refresh aqui */}
                   <ProductionForm onSubmit={handleFormSuccess} />
                 </div>
               </div>

               {/* TABELA */}
               <div className="lg:col-span-8 xl:col-span-9">
                  {isLoading ? (
                    <div className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-green-600" /></div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b bg-slate-50 flex justify-between">
                        <h3 className="font-bold text-slate-700 flex gap-2"><ListChecks /> Registros</h3>
                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">{records.length} total</span>
                      </div>
                      {/* Tabela de Dados */}
                      <ProductionTable records={records} />
                    </div>
                  )}
               </div>
           </div>
        )}

        {activeTab === 'graficos' && (
           <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
             <MoistureTrends records={records} />
           </div>
        )}
      </main>
    </div>
  );
}
