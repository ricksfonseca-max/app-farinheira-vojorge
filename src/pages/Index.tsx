import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { ProductionTable } from "@/components/ProductionTable"; // Mantemos a tabela separada
import { MoistureTrends } from "@/components/MoistureTrends";
import { Header } from "@/components/Header";
// Novos ícones e componentes UI
import { Loader2, ListChecks, BarChart3, Camera, X, Save } from "lucide-react"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();
  
  // Estados da Tela
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');
  
  // Estados do Formulário (Agora aqui dentro para controlar a câmera)
  const [umidade, setUmidade] = useState("");
  const [forno, setForno] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  // --- LÓGICA DA CÂMERA (COMPRESSÃO) ---
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProcessandoFoto(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800; // Reduz para ficar leve
          const scaleSize = MAX_WIDTH / img.width;
          
          // Lógica para manter proporção
          const finalWidth = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
          const finalHeight = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

          canvas.width = finalWidth;
          canvas.height = finalHeight;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, finalWidth, finalHeight);
          
          // Transforma em JPG (Base64)
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setFotoPreview(compressedBase64);
          setProcessandoFoto(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- ENVIAR ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!umidade || !forno) {
      toast({ variant: "destructive", title: "Preencha a umidade e o forno" });
      return;
    }

    const success = await addRecord(Number(umidade), forno, user.name, fotoPreview || "");
    
    if (success) {
      // Limpar formulário
      setUmidade("");
      setForno("");
      setFotoPreview(null);
    }
  };

  // Tela de Carregamento Inicial
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        <p className="mt-4 font-black text-slate-700 uppercase tracking-widest">Carregando Vô Jorge...</p>
      </div>
    );
  }

  // Se não estiver logado, não mostra nada (o useAuth já deve redirecionar ou mostrar AuthForm, mas por segurança:)
  if (!user) return null; 

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header user={user} onLogout={signOut} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        
        {/* BOTÕES DAS ABAS */}
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
             
             {/* --- NOVO FORMULÁRIO COM CÂMERA --- */}
             <Card className="border-t-4 border-t-green-600 shadow-lg max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-green-600" />
                    Novo Lançamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-2">
                         <label className="text-sm font-medium text-gray-700">Umidade (%)</label>
                         <Input 
                            type="number" step="0.1" placeholder="0.0" required
                            className="text-2xl py-6 text-center font-bold tracking-widest"
                            value={umidade} onChange={(e) => setUmidade(e.target.value)}
                         />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-700">Forno</label>
                       <Select value={forno} onValueChange={setForno} required>
                          <SelectTrigger className="py-6"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Forno 01">Forno 01</SelectItem>
                            <SelectItem value="Forno 02">Forno 02</SelectItem>
                            <SelectItem value="Forno 03">Forno 03</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>

                    {/* BOTÃO DA CÂMERA */}
                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-medium text-gray-700 block">Evidência (Foto)</label>
                      {!fotoPreview ? (
                        <div className="relative">
                          <input
                            type="file" accept="image/*" capture="environment"
                            onChange={handlePhotoCapture}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <Button type="button" variant="outline" className="w-full py-8 border-dashed border-2 hover:bg-blue-50">
                             <Camera className="mr-2 h-6 w-6 text-gray-400" />
                             <span className="text-gray-600">{processandoFoto ? "Processando..." : "Tirar Foto"}</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="relative mt-2">
                          <img src={fotoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border" />
                          <Button
                            type="button" variant="destructive" size="icon"
                            className="absolute top-2 right-2 rounded-full shadow-md"
                            onClick={() => setFotoPreview(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full py-6 text-lg bg-green-600 hover:bg-green-700">
                      <Save className="mr-2 h-5 w-5" /> Salvar Registro
                    </Button>
                  </form>
                </CardContent>
             </Card>

             {/* TABELA DE REGISTROS */}
             {recordsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-green-600" /></div>
             ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                  <ProductionTable records={records} onDelete={deleteRecord} />
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
          © {new Date().getFullYear()} Indústria Vô Jorge
        </p>
      </footer>
    </div>
  );
}
