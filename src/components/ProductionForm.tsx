import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets, Gauge, User, GripHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface ProductionFormProps { onSubmit: () => void; }

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const [responsavel, setResponsavel] = useState(""); const [umidade, setUmidade] = useState("");
  const [pressao, setPressao] = useState(""); const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState(""); const [peneira, setPeneira] = useState("");
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string); reader.onerror = error => reject(error);
  });

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFotoArquivo(file); setFotoPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsavel || !umidade || !pressao || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Atenção", description: "Preencha todos os campos." }); return;
    }
    setIsSubmitting(true);
    try {
      let fotoString = ""; if (fotoArquivo) { fotoString = await toBase64(fotoArquivo); }
      const payload = { responsavel, umidade: parseFloat(umidade), pressao: parseFloat(pressao), forno, tipo_farinha: tipoFarinha, peneira, foto: fotoString };
      const sucesso = await api.salvar(payload);
      if (sucesso) {
        toast({ title: "Sucesso!", description: "Dados enviados com sucesso.", className: "bg-emerald-600 text-white border-none" });
        setUmidade(""); setPressao(""); setFotoArquivo(null); setFotoPreview(null); onSubmit();
      }
    } catch (error) { toast({ variant: "destructive", title: "Erro", description: "Falha ao enviar." });
    } finally { setIsSubmitting(false); }
  };

  return (
    <Card className="shadow-2xl border-t-4 border-t-emerald-500 bg-[#0f172a] border-slate-800">
      <CardHeader className="pb-4 border-b border-slate-800/50">
        <CardTitle className="text-xl flex items-center gap-2 text-slate-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Novo Apontamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><User className="w-4 h-4" /> Operador</Label>
            <Input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="h-12 border-slate-700 bg-slate-900 text-slate-100 focus-visible:ring-emerald-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase flex items-center justify-center gap-1"><Droplets className="w-4 h-4 text-cyan-400" /> Umidade (%)</Label>
              <Input type="number" step="0.1" value={umidade} onChange={(e) => setUmidade(e.target.value)} className="text-2xl h-14 text-center font-bold bg-slate-900 border-slate-700 text-cyan-400 focus-visible:ring-cyan-500" required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase flex items-center justify-center gap-1"><Gauge className="w-4 h-4 text-orange-400" /> Pressão (Bar)</Label>
              <Input type="number" step="0.1" value={pressao} onChange={(e) => setPressao(e.target.value)} className="text-2xl h-14 text-center font-bold bg-slate-900 border-slate-700 text-orange-400 focus-visible:ring-orange-500" required />
            </div>
          </div>
          <div className="grid gap-4">
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
              <Label className="text-slate-300 font-bold mb-2 flex items-center gap-2"><Flame className="w-4 h-4 text-rose-500"/> Forno</Label>
              <Select value={forno} onValueChange={setForno}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="!bg-slate-900 text-slate-200 border-slate-700 z-[9999]">
                  <SelectItem value="Forno 01" className="focus:bg-slate-800">Forno 01</SelectItem>
                  <SelectItem value="Forno 02" className="focus:bg-slate-800">Forno 02</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
              <Label className="text-slate-300 font-bold mb-2 flex items-center gap-2"><Wheat className="w-4 h-4 text-amber-500"/> Farinha</Label>
              <Select value={tipoFarinha} onValueChange={setTipoFarinha}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="!bg-slate-900 text-slate-200 border-slate-700 z-[9999]">
                  <SelectItem value="Tipo 1" className="focus:bg-slate-800">Branca</SelectItem><SelectItem value="Tipo 2" className="focus:bg-slate-800">Amarela</SelectItem>
                  <SelectItem value="Integral" className="focus:bg-slate-800">Integral</SelectItem><SelectItem value="Biju" className="focus:bg-slate-800">Bijú</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
              <Label className="text-slate-300 font-bold mb-2 flex items-center gap-2"><GripHorizontal className="w-4 h-4 text-slate-400"/> Peneira</Label>
              <Select value={peneira} onValueChange={setPeneira}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="!bg-slate-900 text-slate-200 border-slate-700 z-[9999]">
                  <SelectItem value="Fina" className="focus:bg-slate-800">Fina</SelectItem><SelectItem value="Media" className="focus:bg-slate-800">Média</SelectItem><SelectItem value="Grossa" className="focus:bg-slate-800">Grossa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-800 mt-4">
            {!fotoPreview ? (
              <div className="relative group">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Button type="button" variant="outline" className="w-full h-14 border-dashed border-2 border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"><Camera className="mr-2 h-5 w-5" /> FOTO (OPCIONAL)</Button>
              </div>
            ) : (
              <div className="relative border border-slate-700 rounded-lg p-1 bg-slate-900">
                <img src={fotoPreview} alt="Preview" className="w-full h-48 object-cover rounded-md opacity-90" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-3 right-3 rounded-full shadow-lg" onClick={() => { setFotoArquivo(null); setFotoPreview(null); }}><X className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "REGISTRAR LOTE"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
