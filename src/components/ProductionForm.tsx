import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Camera, X, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import type { ProductionFormData } from "@/types/production";

interface ProductionFormProps {
  // Agora esperamos que a função retorne um booleano (promessa)
  onSubmit: (data: Omit<ProductionFormData, "usuario">) => Promise<boolean>;
}

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  // Estados dos campos
  const [umidade, setUmidade] = useState("");
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState("");
  const [peneira, setPeneira] = useState("");
  
  // Estados da Foto
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CHAVE MÁGICA DE RESET
  // Toda vez que esse número mudar, o input de arquivo é destruído e recriado
  const [resetKey, setResetKey] = useState(0);

  // --- LÓGICA DE COMPRESSÃO DA FOTO ---
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProcessingPhoto(true);
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
          setProcessingPhoto(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!umidade || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios!" });
      return;
    }

    setIsSubmitting(true);

    // Envia e espera a resposta (Sucesso ou Falha)
    const sucesso = await onSubmit({
      umidade: Number(umidade),
      forno,
      tipoFarinha,
      peneira,
      foto: fotoPreview || "" 
    });

    setIsSubmitting(false);

    // SE DEU CERTO, LIMPA TUDO
    if (sucesso) {
      setUmidade("");
      setForno("");
      setTipoFarinha("");
      setPeneira("");
      setFotoPreview(null);
      // Incrementa a chave para forçar o input a zerar
      setResetKey(prev => prev + 1);
    }
  };

  // Botão X para remover foto manualmente
  const removePhoto = () => {
    setFotoPreview(null);
    setResetKey(prev => prev + 1);
  };

  return (
    <Card className="shadow-lg border-t-4 border-t-green-600 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Novo Registro de Produção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Campo de Umidade Gigante */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-600">Umidade (%)</label>
            <Input 
              type="number" step="0.1" placeholder="0.0"
              value={umidade} onChange={(e) => setUmidade(e.target.value)}
              className="text-3xl py-8 text-center font-bold tracking-widest bg-slate-50 border-slate-200 focus:border-green-500"
              required
            />
          </div>

          {/* Grid de Seleção */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Forno</label>
              <Select value={forno} onValueChange={setForno} required>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Forno 01">Forno 01</SelectItem>
                  <SelectItem value="Forno 02">Forno 02</SelectItem>
                  <SelectItem value="Forno 03">Forno 03</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Farinha</label>
              <Select value={tipoFarinha} onValueChange={setTipoFarinha} required>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Especial">Especial</SelectItem>
                  <SelectItem value="Comum">Comum</SelectItem>
                  <SelectItem value="Integral">Integral</SelectItem>
                  <SelectItem value="Pré-Mistura">Pré-Mistura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Peneira / Bica</label>
            <Select value={peneira} onValueChange={setPeneira} required>
              <SelectTrigger><SelectValue placeholder="Selecione a Bica" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bica 01">Bica 01</SelectItem>
                <SelectItem value="Bica 02">Bica 02</SelectItem>
                <SelectItem value="Bica 03">Bica 03</SelectItem>
                <SelectItem value="Bica 04">Bica 04</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Área da Câmera */}
          <div className="space-y-2 pt-4 border-t border-dashed border-slate-200 mt-4">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Evidência Visual (Foto)</label>
            
            {!fotoPreview ? (
              <div className="relative group">
                {/* O atributo KEY força o React a recriar este input quando o valor muda */}
                <input
                  key={resetKey} 
                  type="file" accept="image/*" capture="environment"
                  onChange={handlePhotoCapture}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Button type="button" variant="outline" className="w-full py-6 border-dashed border-2 hover:bg-slate-50 hover:border-green-400 transition-all">
                  <Camera className="mr-2 h-6 w-6 text-slate-400 group-hover:text-green-600" />
                  <span className="text-slate-500 group-hover:text-green-700 font-medium">
                    {processingPhoto ? "Comprimindo..." : "Tirar Foto / Anexar"}
                  </span>
                </Button>
              </div>
            ) : (
              <div className="relative mt-2 animate-in zoom-in duration-300">
                <img src={fotoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-slate-200 shadow-sm" />
                <Button
                  type="button" variant="destructive" size="icon"
                  className="absolute top-2 right-2 rounded-full shadow-md w-8 h-8"
                  onClick={removePhoto} 
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-green-600 font-bold mt-1">Imagem anexada ✓</p>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting || processingPhoto} className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 font-bold shadow-lg shadow-green-100 mt-4">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Registro"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
