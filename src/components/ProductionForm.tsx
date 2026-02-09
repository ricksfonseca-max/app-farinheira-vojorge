import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets, Gauge } from "lucide-react"; // Importe o Gauge
import { toast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface ProductionFormProps {
  onSubmit: () => void;
}

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const [umidade, setUmidade] = useState("");
  const [pressao, setPressao] = useState(""); // <--- Estado da Pressão
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState("");
  const [peneira, setPeneira] = useState("");
  
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ... (função toBase64 e handlePhotoCapture iguais) ...
  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoArquivo(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!umidade || !pressao || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Atenção", description: "Preencha Umidade, Pressão e os outros campos." });
      return;
    }

    setIsSubmitting(true);

    try {
      let fotoString = "";
      if (fotoArquivo) {
        fotoString = await toBase64(fotoArquivo);
      }

      const payload = {
        umidade: parseFloat(umidade),
        pressao: parseFloat(pressao), // <--- Enviando Pressão
        forno,
        tipo_farinha: tipoFarinha,
        peneira,
        responsavel: "Operador App",
        foto: fotoString
      };

      const sucesso = await api.salvar(payload);

      if (sucesso) {
        toast({ title: "Sucesso!", description: "Dados de produção registrados.", className: "bg-green-600 text-white border-none" });
        
        setUmidade("");
        setPressao(""); // Limpa campo
        setForno("");
        setTipoFarinha("");
        setPeneira("");
        setFotoArquivo(null);
        setFotoPreview(null);
        
        onSubmit();
      } else {
        throw new Error("Erro API");
      }

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao conectar com o servidor." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg border-t-4 border-t-green-600 bg-white">
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="text-xl flex items-center gap-2 text-slate-800">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          Novo Registro
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* PAINEL PRINCIPAL: UMIDADE E PRESSÃO LADO A LADO */}
          <div className="grid grid-cols-2 gap-4">
            {/* UMIDADE */}
            <div className="space-y-2 text-center">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Umidade (%)</Label>
              <Input 
                type="number" step="0.1" placeholder="0.0"
                value={umidade} onChange={(e) => setUmidade(e.target.value)}
                className="text-4xl py-6 h-auto text-center font-bold tracking-tighter bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {/* PRESSÃO */}
            <div className="space-y-2 text-center">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                <Gauge className="w-3 h-3" /> Pressão (CV)
              </Label>
              <Input 
                type="number" step="0.1" placeholder="0.0"
                value={pressao} onChange={(e) => setPressao(e.target.value)}
                className="text-4xl py-6 h-auto text-center font-bold tracking-tighter bg-orange-50 border-orange-200 text-orange-800 rounded-xl focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* GRID DE SELEÇÃO (MANTIDO IGUAL) */}
          <div className="grid gap-4">
             {/* ... (O restante dos selects Forno, Tipo Farinha, Peneira continua igual ao seu código original) ... */}
              {/* Vou omitir aqui para economizar espaço, mas mantenha o código dos Selects que você já fez */}
             
             {/* Exemplo só pra constar onde entra o resto */}
             <div className="border rounded-lg bg-orange-50 p-4 shadow-sm border-orange-100">
              <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold">
                <Flame className="w-5 h-5"/> 
                <Label>Forno</Label>
              </div>
              <Select value={forno} onValueChange={setForno}>
                <SelectTrigger className="bg-white border-orange-200 h-12 text-lg font-medium text-slate-700 shadow-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-orange-200">
                  <SelectItem value="Forno 01">Forno 01</SelectItem>
                  <SelectItem value="Forno 02">Forno 02</SelectItem>
                </SelectContent>
              </Select>
            </div>
             {/* Repita para Tipo Farinha e Peneira... */}
          </div>

          {/* ... FOTO E BOTÃO SUBMIT MANTIDOS IGUAIS ... */}
          <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
             {/* Código da foto igual ao original */}
             {!fotoPreview ? (
              <div className="relative group">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Button type="button" variant="outline" className="w-full h-14 border-dashed border-2 text-slate-500 hover:text-green-600 hover:border-green-500 bg-slate-50">
                  <Camera className="mr-2 h-5 w-5" /> FOTO AMOSTRA
                </Button>
              </div>
            ) : (
               // ... Preview da foto igual ...
               <div className="relative animate-in zoom-in duration-300">
                <img src={fotoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg shadow-md border border-slate-200" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full shadow-lg" onClick={() => { setFotoArquivo(null); setFotoPreview(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 font-bold shadow-md transition-all active:scale-[0.98]">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "SALVAR PRODUÇÃO"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
