import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import type { ProductionFormData } from "@/types/production";

interface ProductionFormProps {
  onSubmit: (data: Omit<ProductionFormData, "usuario">) => Promise<boolean>;
}

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  // --- ESTADOS ---
  const [umidade, setUmidade] = useState("");
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState("");
  const [peneira, setPeneira] = useState("");
  
  // Estados da Foto
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chave para resetar o input de arquivo
  const [resetKey, setResetKey] = useState(0);

  // --- LÓGICA DE FOTO ---
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

  // --- ENVIO ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!umidade || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios!" });
      return;
    }

    setIsSubmitting(true);

    const sucesso = await onSubmit({
      umidade: Number(umidade),
      forno,
      tipoFarinha,
      peneira,
      foto: fotoPreview || "" 
    });

    setIsSubmitting(false);

    if (sucesso) {
      setUmidade("");
      setForno("");
      setTipoFarinha("");
      setPeneira("");
      setFotoPreview(null);
      setResetKey(prev => prev + 1);
    }
  };

  const removePhoto = () => {
    setFotoPreview(null);
    setResetKey(prev => prev + 1);
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
          
          {/* UMIDADE */}
          <div className="space-y-2 text-center">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Umidade (%)</label>
            <Input 
              type="number" step="0.1" placeholder="0.0"
              value={umidade} onChange={(e) => setUmidade(e.target.value)}
              className="text-5xl py-10 h-auto text-center font-bold tracking-tighter bg-slate-50 border-slate-200 focus:border-green-500 text-slate-800 rounded-xl shadow-inner"
              required
            />
          </div>

          {/* ACORDEÃO */}
          <Accordion type="single" collapsible className="w-full space-y-3">
            
            {/* 1. FORNO (Tema Laranja) */}
            <AccordionItem value="forno" className="border rounded-lg border-orange-200 bg-orange-50 overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-orange-100 text-orange-800 font-bold">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-600" />
                  Forno
                  {forno && <span className="ml-2 text-xs bg-white text-orange-600 px-2 py-1 rounded-full shadow-sm">{forno}</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 bg-orange-50">
                <Select value={forno} onValueChange={setForno} required>
                  <SelectTrigger className="bg-white border-orange-200 text-slate-700">
                      <SelectValue placeholder="Selecione o Forno" />
                  </SelectTrigger>
                  
                  {/* MENU COLORIDO - LARANJA */}
                  <SelectContent className="bg-orange-50 border-orange-200">
                    <SelectItem value="Forno 01" className="focus:bg-orange-200 cursor-pointer text-orange-900">Forno 01</SelectItem>
                    <SelectItem value="Forno 02" className="focus:bg-orange-200 cursor-pointer text-orange-900">Forno 02</SelectItem>
                    <SelectItem value="Forno 03" className="focus:bg-orange-200 cursor-pointer text-orange-900">Forno 03</SelectItem>
                  </SelectContent>
                
                </Select>
              </AccordionContent>
            </AccordionItem>

            {/* 2. FARINHA (Tema Bege/Pedra) */}
            <AccordionItem value="farinha" className="border rounded-lg border-stone-200 bg-stone-100 overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-stone-200 text-stone-700 font-bold">
                <div className="flex items-center gap-2">
                  <Wheat className="w-5 h-5 text-stone-600" />
                  Tipo de Farinha
                  {tipoFarinha && <span className="ml-2 text-xs bg-white text-stone-600 px-2 py-1 rounded-full shadow-sm">{tipoFarinha}</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 bg-stone-100">
                <Select value={tipoFarinha} onValueChange={setTipoFarinha} required>
                  <SelectTrigger className="bg-white border-stone-300 text-slate-700">
                      <SelectValue placeholder="Selecione o Tipo" />
                  </SelectTrigger>
                  
                  {/* MENU COLORIDO - BEGE */}
                  <SelectContent className="bg-stone-100 border-stone-200">
                    <SelectItem value="Especial" className="focus:bg-stone-200 cursor-pointer text-stone-900">Especial</SelectItem>
                    <SelectItem value="Comum" className="focus:bg-stone-200 cursor-pointer text-stone-900">Comum</SelectItem>
                    <SelectItem value="Integral" className="focus:bg-stone-200 cursor-pointer text-stone-900">Integral</SelectItem>
                    <SelectItem value="Pré-Mistura" className="focus:bg-stone-200 cursor-pointer text-stone-900">Pré-Mistura</SelectItem>
                  </SelectContent>

                </Select>
              </AccordionContent>
            </AccordionItem>

            {/* 3. BICA (Tema Azul) */}
            <AccordionItem value="bica" className="border rounded-lg border-blue-200 bg-blue-50 overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-blue-100 text-blue-800 font-bold">
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-600" />
                  Peneira / Bica
                  {peneira && <span className="ml-2 text-xs bg-white text-blue-600 px-2 py-1 rounded-full shadow-sm">{peneira}</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 bg-blue-50">
                <Select value={peneira} onValueChange={setPeneira} required>
                  <SelectTrigger className="bg-white border-blue-200 text-slate-700">
                    <SelectValue placeholder="Selecione a Bica" />
                  </SelectTrigger>
                  
                  {/* MENU COLORIDO - AZUL */}
                  <SelectContent className="bg-blue-50 border-blue-200">
                    <SelectItem value="Bica 01" className="focus:bg-blue-200 cursor-pointer text-blue-900">Bica 01</SelectItem>
                    <SelectItem value="Bica 02" className="focus:bg-blue-200 cursor-pointer text-blue-900">Bica 02</SelectItem>
                    <SelectItem value="Bica 03" className="focus:bg-blue-200 cursor-pointer text-blue-900">Bica 03</SelectItem>
                    <SelectItem value="Bica 04" className="focus:bg-blue-200 cursor-pointer text-blue-900">Bica 04</SelectItem>
                  </SelectContent>

                </Select>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          {/* FOTO */}
          <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Evidência (Opcional)</label>
            
            {!fotoPreview ? (
              <div className="relative group">
                <input
                  key={resetKey} 
                  type="file" accept="image/*" capture="environment"
                  onChange={handlePhotoCapture}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <Button type="button" variant="outline" className="w-full h-14 border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-white hover:border-green-500 transition-all text-slate-500 hover:text-green-600">
                  <Camera className="mr-2 h-5 w-5" />
                  {processingPhoto ? "Processando..." : "Anexar Foto"}
                </Button>
              </div>
            ) : (
              <div className="relative animate-in fade-in zoom-in duration-300">
                <img src={fotoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-slate-200 shadow-sm" />
                <Button
                  type="button" variant="destructive" size="icon"
                  className="absolute top-2 right-2 rounded-full w-8 h-8 shadow-md"
                  onClick={removePhoto} 
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting || processingPhoto} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 font-bold shadow-md hover:shadow-lg transition-all">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Salvar Registro"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
