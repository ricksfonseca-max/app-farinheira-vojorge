import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets } from "lucide-react";
import { toast } from "@/hooks/use-toast"; // Verifica se o path do hook está correto no teu projeto
import { api } from "@/services/api";

interface ProductionFormProps {
  onSubmit: () => void; // Callback para atualizar a tabela após salvar
}

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const [umidade, setUmidade] = useState("");
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState("");
  const [peneira, setPeneira] = useState("");
  
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Função auxiliar: Arquivo -> Base64
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
    
    if (!umidade || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos obrigatórios." });
      return;
    }

    setIsSubmitting(true);

    try {
      let fotoString = "";
      if (fotoArquivo) {
        fotoString = await toBase64(fotoArquivo);
      }

      // Mapeamento dos campos para o formato que o Node-RED espera
      const payload = {
        umidade: parseFloat(umidade),
        forno,
        tipo_farinha: tipoFarinha, // Snake_case no banco? O Node-RED resolve.
        peneira,
        responsavel: "Operador App", // Podes pegar do contexto de auth depois
        foto: fotoString
      };

      const sucesso = await api.salvar(payload);

      if (sucesso) {
        toast({ title: "Sucesso!", description: "Produção registrada no sistema." });
        
        // Limpar formulário
        setUmidade("");
        setForno("");
        setTipoFarinha("");
        setPeneira("");
        setFotoArquivo(null);
        setFotoPreview(null);
        
        // Atualizar lista
        onSubmit();
      } else {
        throw new Error("API retornou erro");
      }

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro de Conexão", description: "Verifique se o servidor está online." });
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
          
          <div className="space-y-2 text-center">
            <label className="text-sm font-bold text-slate-500 uppercase">Umidade (%)</label>
            <Input 
              type="number" step="0.1" placeholder="0.0"
              value={umidade} onChange={(e) => setUmidade(e.target.value)}
              className="text-5xl py-8 h-auto text-center font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl"
              required
            />
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            <AccordionItem value="forno" className="border rounded-lg bg-orange-50">
              <AccordionTrigger className="px-4 font-bold text-orange-800"><div className="flex gap-2"><Flame className="w-5 h-5"/> Forno {forno}</div></AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Select value={forno} onValueChange={setForno}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Forno 01">Forno 01</SelectItem>
                    <SelectItem value="Forno 02">Forno 02</SelectItem>
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tipo" className="border rounded-lg bg-stone-100">
              <AccordionTrigger className="px-4 font-bold text-stone-800"><div className="flex gap-2"><Wheat className="w-5 h-5"/> Tipo {tipoFarinha}</div></AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Select value={tipoFarinha} onValueChange={setTipoFarinha}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Especial">Especial</SelectItem>
                    <SelectItem value="Comum">Comum</SelectItem>
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="peneira" className="border rounded-lg bg-blue-50">
              <AccordionTrigger className="px-4 font-bold text-blue-800"><div className="flex gap-2"><Droplets className="w-5 h-5"/> Peneira {peneira}</div></AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Select value={peneira} onValueChange={setPeneira}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bica 01">Bica 01</SelectItem>
                    <SelectItem value="Bica 02">Bica 02</SelectItem>
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
            {!fotoPreview ? (
              <div className="relative">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Button type="button" variant="outline" className="w-full h-14 border-dashed border-2 text-slate-500">
                  <Camera className="mr-2 h-5 w-5" /> Tirar Foto
                </Button>
              </div>
            ) : (
              <div className="relative">
                <img src={fotoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full" onClick={() => { setFotoArquivo(null); setFotoPreview(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 font-bold shadow-md">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "SALVAR REGISTRO"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
