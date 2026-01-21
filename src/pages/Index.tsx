import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { ProductionTable } from "@/components/ProductionTable"; 
import { MoistureTrends } from "@/components/MoistureTrends";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm"; // Importante para não quebrar se deslogar

// Componentes Visuais
import { Loader2, ListChecks, BarChart3, Camera, X, Save, Factory } from "lucide-react"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();
  
  const [activeTab, setActiveTab] = useState<'registros' | 'graficos'>('registros');
  
  // ESTADOS DO FORMULÁRIO (Todos os campos restaurados)
  const [umidade, setUmidade] = useState("");
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState(""); // Restaurado
  const [peneira, setPeneira] = useState("");         // Restaurado (Bica)
  
  // CÂMERA
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  // Lógica de Foto (Compressão)
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProcessandoFoto(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800; 
          const scaleSize = MAX_WIDTH / img.width;
          const finalWidth = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
          const finalHeight = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
          canvas.width = finalWidth;
          canvas.height = finalHeight;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, finalWidth, finalHeight);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setFotoPreview(compressedBase64);
          setProcessandoFoto(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Envio do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validação Básica
    if (!umidade || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Preencha todos os campos!" });
      return;
    }

    const success = await addRecord({
      umidade: Number(umidade),
      forno,
      tipoFarinha,
      peneira,
      foto: fotoPreview || ""
    }, user.name);
    
    if (success) {
      // Limpa tudo
      setUmidade("");
      setForno("");
      setTipoFarinha("");
      setPeneira("");
      setFotoPreview(null);
    }
  };

  // Carregando...
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  // Se não tem usuário, mostra tela de login
  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header user={user} onLogout={signOut} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex items-center justify-center p-1 bg-slate-200/50 rounded-xl w-full max-w-md mx-auto mb-6">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'registros' ? "bg-white text-green-700 shadow-sm" : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            <ListChecks size={18} /> REGISTROS
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'graficos' ? "bg-white text-green-700 shadow-sm" : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            <BarChart3 size={18} /> GRÁFICOS
          </button>
        </div>

        {/* ABA 1: REGISTROS + FORMULÁRIO */}
        {activeTab === 'registros' && (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* FORMULÁRIO COMPLETO */}
             <Card className="border-t-4 border-t-green-600 shadow-lg max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Factory className="h-5 w-5 text-green-600" />
                    Novo Lançamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Linha 1: Umidade (Destaque) */}
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-700">Umidade (%)</label>
                       <Input 
                          type="number" step="0.1" placeholder="0.0" required
                          className="text-3xl py-8 text-center font-bold tracking-widest bg-slate-50"
                          value={umidade} onChange={(e) => setUmidade(e.target.value)}
                       />
                    </div>

                    {/* Linha 2: Forno e Tipo Farinha */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-sm font-medium text-gray-600">Forno</label>
                         <Select value={forno} onValueChange={setForno} required>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Forno 01">Forno 01</SelectItem>
                              <SelectItem value="Forno 02">Forno 02</SelectItem>
                              <SelectItem value="Forno 03">Forno 03</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-sm font-medium text-gray-600">Tipo Farinha</label>
                         <Select value={tipoFarinha} onValueChange={setTipoFarinha} required>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Especial">Especial</SelectItem>
                              <SelectItem value="Comum">Comum</SelectItem>
                              <SelectItem value="Integral">Integral</SelectItem>
                              <SelectItem value="Outro">Outro</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                    </div>

                    {/* Linha 3: Peneira (Bica) */}
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-600">Peneira / Bica</label>
                       <Select value={peneira} onValueChange={setPeneira} required>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione a Bica" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bica 01">Bica 01</SelectItem>
                            <SelectItem value="Bica 02">Bica 02</SelectItem>
                            <SelectItem value="Bica 03">Bica 03</SelectItem>
                            <SelectItem value="Bica 04">Bica 04</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>

                    {/* FOTO (CÂMERA) */}
                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-bold text-gray-700 block">Evidência (Foto)</label>
                      {!fotoPreview ? (
                        <div className="relative">
                          <input
                            type="file" accept="image/*" capture="environment"
                            onChange={handlePhotoCapture}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <Button type="button" variant="outline" className="w-full py-8 border-dashed border-2 hover:bg-blue-50 transition-all">
                             <Camera className="mr-2 h-6 w-6 text-gray-400" />
                             <span className="text-gray-600 font-medium">
                               {processandoFoto ? "Processando..." : "Tirar Foto"}
                             </span>
                          </Button>
                        </div>
                      ) : (
                        <div className="relative mt-2 animate-in zoom-in duration-300">
                          <img src={fotoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-slate-200" />
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

                    <Button type="submit" className="w-full py-6 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95">
                      <Save className="mr-2 h-5 w-5" /> Salvar Lançamento
                    </Button>
                  </form>
                </CardContent>
             </Card>

             {/* TABELA */}
             {recordsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-green-600" /></div>
             ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                  <ProductionTable records={records} onDelete={deleteRecord} />
                </div>
             )}
           </div>
        )}

        {/* ABA 2: GRÁFICOS */}
        {activeTab === 'graficos' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <MoistureTrends records={records} />
           </div>
        )}

      </main>

      <footer className="py-6 text-center border-t border-slate-200 mt-8 bg-white">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} Indústria Vô Jorge
        </p>
      </footer>
    </div>
  );
}
