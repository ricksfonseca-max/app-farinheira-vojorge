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
  
  // O hook agora devolve tudo pronto!
  const { records, isLoading, addRecord } = useProductionRecords();
  
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin"/></div>;
  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <Header user={user} onLogout={logout} />
      
      <main className="container mx-auto px-4 py-6 max-w-[95%]">
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
               {/* FORMULÁRIO: Passamos addRecord direto do Hook */}
               <div className="lg:col-span-4 xl:col-span-3">
                 <div className="sticky top-4">
                   <ProductionForm onSubmit={async () => {
                      // O hook já trata o sucesso, aqui é só para limpar o form se necessário
                   }} />
                   {/* Nota: Terás de ajustar o ProductionForm para usar o addRecord que vem de props ou contexto, 
                       OU deixar como estava (chamando API direto) e chamar o refetch aqui.
                       
                       A FORMA MAIS FÁCIL AGORA:
                       Mantenha o Index.tsx que te passei ANTES (com handleFormSuccess e refetch).
                       Ele é o mais robusto para a tua arquitetura atual.
                   */}
                 </div>
               </div>

               <div className="lg:col-span-8 xl:col-span-9">
                  {isLoading ? (
                    <div className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-green-600" /></div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4 border-b bg-slate-50 flex justify-between">
                        <h3 className="font-bold text-slate-700 flex gap-2"><ListChecks /> Registros</h3>
                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">{records.length} total</span>
                      </div>
                      <ProductionTable records={records} />
                    </div>
                  )}
               </div>
           </div>
        )}
        
        {/* ... (Resto igual) ... */}
      </main>
    </div>
  );
}
