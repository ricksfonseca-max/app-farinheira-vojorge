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
  // 🐛 CORREÇÃO AQUI: Mudamos de 'signOut' para 'logout'
  const { user, loading: authLoading, logout } = useAuth();
  
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();
  
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      {/* Agora passamos a função 'logout' correta para o Header */}
      <Header user={user} onLogout={logout} />
      
      {/* CONTAINER LARGURA TOTAL (Max-w-7xl preenche quase tudo) */}
      <main className="container mx-auto px-4 py-6 max-w-[95%]">
        
        {/* MENU DE ABAS (Agora horizontal e esticado) */}
        <div className="flex items-center gap-4 mb-6 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'registros' 
                ? "border-green-600 text-green-700 bg-green-50/50" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            <LayoutDashboard size={18} />
            PAINEL DE CONTROLE
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'graficos' 
                ? "border-green-600 text-green-700 bg-green-50/50" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            <BarChart3 size={18} />
            INDICADORES
          </button>
        </div>

        {/* CONTEÚDO DA ABA: REGISTROS (LAYOUT LADO A LADO) */}
        {activeTab === 'registros' && (
           <div className="animate-in fade-in duration-500">
             
             {/* GRID: Esquerda (Formulário) - Direita (Tabela) */}
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               
               {/* COLUNA 1: FORMULÁRIO (Ocupa 4 partes de 12 no PC) */}
               <div className="lg:col-span-4 xl:col-span-3">
                 <div className="sticky top-4"> {/* Faz o form acompanhar a rolagem */}
                   <ProductionForm onSubmit={addRecord} />
                 </div>
               </div>

               {/* COLUNA 2: TABELA (Ocupa 8 partes de 12 no PC) */}
               <div className="lg:col-span-8 xl:col-span-9">
                  {recordsLoading ? (
                    <div className="bg-white p-20 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
                      <p className="text-slate-400 font-medium">Sincronizando Fábrica...</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-slate-400" />
                          Últimos Registros
                        </h3>
                        <span className="text-xs font-mono text-slate-400 bg-slate-200 px-2 py-1 rounded">
                          {records.length} lançamentos
                        </span>
                      </div>
                      <ProductionTable records={records} onDelete={deleteRecord} />
                    </div>
                  )}
               </div>

             </div>
           </div>
        )}

        {/* CONTEÚDO DA ABA: GRÁFICOS (Largura Total) */}
        {activeTab === 'graficos' && (
           <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
             <MoistureTrends records={records} />
           </div>
        )}

      </main>

      <footer className="py-6 text-center border-t border-slate-200 mt-12 bg-white text-slate-400 text-xs">
         © {new Date().getFullYear()} Indústria Vô Jorge - Sistema Integrado de Qualidade
      </footer>
    </div>
  );
}
