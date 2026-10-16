import { useState } from "react";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { MoistureTrends } from "@/components/MoistureTrends";
import { Header } from "@/components/Header";
import { PainelFornos } from "@/components/PainelFornos";
import { GraficosFornos } from "@/components/GraficosFornos";
import { Loader2, ListChecks, BarChart3, LayoutDashboard } from "lucide-react";

export default function Index() {
  const { records, isLoading, refetch } = useProductionRecords();
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');
  const [versaoFornos, setVersaoFornos] = useState(0);

  const handleFormSuccess = () => {
    setVersaoFornos((v) => v + 1);
    refetch();
    setTimeout(() => refetch(), 500);
  };

  return (
    <div className="min-h-screen bg-mata-975 text-mata-200 pb-10 font-sans selection:bg-marca-500/30">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-[95%]">
        <div className="flex items-center gap-4 mb-6 border-b border-mata-800 pb-1">
          <button onClick={() => setActiveTab('registros')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'registros' ? "border-marca-500 text-marca-400 bg-marca-500/10" : "border-transparent text-mata-500 hover:text-mata-300"}`}>
            <LayoutDashboard size={18} /> PAINEL
          </button>
          <button onClick={() => setActiveTab('graficos')} className={`flex gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'graficos' ? "border-marca-500 text-marca-400 bg-marca-500/10" : "border-transparent text-mata-500 hover:text-mata-300"}`}>
            <BarChart3 size={18} /> GRÁFICOS
          </button>
        </div>

        {activeTab === 'registros' && (
           <div className="animate-in fade-in duration-500 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               {/* Apontamento: primeiro no celular, fixo à esquerda no computador */}
               <div className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-4">
                 <div className="bg-mata-900 rounded-xl shadow-2xl border border-mata-800 overflow-hidden p-1">
                   <ProductionForm onSubmit={handleFormSuccess} />
                 </div>
               </div>

               <div className="lg:col-span-8 xl:col-span-9 min-w-0">
                  <PainelFornos atualizar={versaoFornos} />

                  {isLoading ? (
                    <div className="bg-mata-900 p-20 text-center rounded-xl shadow-2xl border border-mata-800">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-marca-500 mb-2" />
                      <p className="text-mata-400">Carregando dados da planta...</p>
                    </div>
                  ) : (
                    <div className="bg-mata-900 rounded-xl shadow-2xl border border-mata-800 overflow-hidden">
                      <div className="p-4 border-b border-mata-800 bg-mata-950 flex justify-between items-center">
                        <h3 className="font-bold text-mata-200 flex gap-2"><ListChecks className="text-marca-500"/> Histórico Recente</h3>
                        <span className="text-xs bg-mata-800 text-marca-400 px-2 py-1 rounded font-mono border border-mata-700">{records.length} registros</span>
                      </div>
                      <ProductionTable records={records} />
                    </div>
                  )}
               </div>
           </div>
        )}

        {activeTab === 'graficos' && (
           <div className="animate-in fade-in duration-500">
             <GraficosFornos />
             <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-mata-400">Histórico de apontamentos</h3>
             <div className="max-w-5xl bg-mata-900 rounded-xl shadow-2xl border border-mata-800 p-4">
               <MoistureTrends records={records} />
             </div>
           </div>
        )}
      </main>
    </div>
  );
}
