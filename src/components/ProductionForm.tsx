import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets, Gauge, User, GripHorizontal, Building2, Package, Box } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface ProductionFormProps { onSubmit: () => void; }

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const [responsavel, setResponsavel] = useState(""); 
  const [umidade, setUmidade] = useState("");
  const [pressao, setPressao] = useState(""); 
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState(""); 
  const [peneira, setPeneira] = useState("");
  // --- NOVOS ESTADOS ---
  const [cliente, setCliente] = useState("");
  const [produto, setProduto] = useState("");
  const [ensaque, setEnsaque] = useState("");
  
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- BUSCA PRESSÃO DO NODE-RED ---
  useEffect(() => {
    const puxarPressao = async () => {
      try {
        const res = await fetch('https://api.fsk.tec.br/api/pressao-forno');
        const data = await res.json();
        if (data && data.pressao !== undefined) setPressao(data.pressao.toString());
      } catch (e) { console.error("Erro leitura pressão:", e); }
    };
    puxarPressao();
    const interval = setInterval(puxarPressao, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFotoArquivo(file); setFotoPreview(URL.createObjectURL(file)); }
  };

  const toBase64 = (file: File) => new Promise<string>((res, rej) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = () => res(reader.result as string); reader.onerror = rej;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsavel || !umidade || !pressao || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Atenção", description: "Preencha os campos obrigatórios." }); return;
    }
    setIsSubmitting(true);
    try {
      let fotoString = ""; if (fotoArquivo) fotoString = await toBase64(fotoArquivo);
      
      // Lógica de 3 Turnos
      const hora = new Date().getHours();
      let turno = 3;
      if (hora >= 6 && hora < 14) turno = 1;
      else if (hora >= 14 && hora < 22) turno = 2;

      const sucesso = await api.salvar({
        responsavel, umidade: parseFloat(umidade), pressao: parseFloat(pressao),
        forno, tipo_farinha: tipoFarinha, peneira, foto: fotoString,
        turno_num: turno, cliente, produto, ensaque
      });

      if (sucesso) {
        toast({ title: "Sucesso!", description: "Lote registrado." });
        setUmidade(""); setFotoArquivo(null); setFotoPreview(null); onSubmit();
      }
    } catch (error) { toast({ variant: "destructive", title: "Erro ao salvar" });
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-400 uppercase"><User className="inline w-3 h-3 mr-1"/> Operador</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="bg-slate-900 border-slate-700 text-slate-100" required />
          </div>

          {/* COLUNAS NOVAS: CLIENTE E PRODUTO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase"><Building2 className="inline w-3 h-3 mr-1"/> Cliente</Label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} list="lista-clientes" className="bg-slate-900 border-slate-700" placeholder="Opcional" />
              <datalist id="lista-clientes"><option value="Amafil"/><option value="Yoki"/><option value="Exportação"/></datalist>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase"><Package className="inline w-3 h-3 mr-1"/> Produto</Label>
              <Input value={produto} onChange={(e) => setProduto(e.target.value)} list="lista-produtos" className="bg-slate-900 border-slate-700" placeholder="Opcional" />
              <datalist id="lista-produtos"><option value="Amido Nativo"/><option value="Fécula Premium"/></datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-400 uppercase"><Box className="inline w-3 h-3 mr-1"/> Ensaque</Label>
            <Input value={ensaque} onChange={(e) => setEnsaque(e.target.value)} list="lista-ensaque" className="bg-slate-900 border-slate-700" placeholder="Ex: Saco 25kg" />
            <datalist id="lista-ensaque"><option value="Saco 25Kg Valvulado"/><option value="Big Bag 1000Kg"/><option value="Saco Papel 25Kg"/></datalist>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 text-center">
              <Label className="text-xs font-bold text-cyan-400 uppercase"><Droplets className="inline w-3 h-3 mr-1"/> Umidade (%)</Label>
              <Input type="number" step="0.1" value={umidade} onChange={(e) => setUmidade(e.target.value)} className="h-12 text-xl text-center font-bold bg-slate-900 border-slate-700 text-cyan-400" required />
            </div>
            <div className="space-y-2 text-center">
              <Label className="text-xs font-bold text-orange-400 uppercase"><Gauge className="inline w-3 h-3 mr-1"/> Pressão</Label>
              <Input type="number" step="0.1" value={pressao} onChange={(e) => setPressao(e.target.value)} className="h-12 text-xl text-center font-bold bg-slate-800 border-orange-500/50 text-orange-400" required />
            </div>
          </div>

          <div className="grid gap-3">
            <Select value={forno} onValueChange={setForno}>
              <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Selecione o Forno" /></SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100 border-slate-700"><SelectItem value="Forno 01">Forno 01</SelectItem><SelectItem value="Forno 02">Forno 02</SelectItem></SelectContent>
            </Select>

            <Select value={tipoFarinha} onValueChange={setTipoFarinha}>
              <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Tipo de Farinha" /></SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100 border-slate-700"><SelectItem value="Branca">Branca</SelectItem><SelectItem value="Amarela">Amarela</SelectItem><SelectItem value="Integral">Integral</SelectItem></SelectContent>
            </Select>

            <div className="space-y-2">
              <Input value={peneira} onChange={(e) => setPeneira(e.target.value)} list="lista-peneiras" className="bg-slate-900 border-slate-700" placeholder="Peneira (Ex: 1.0mm)" required />
              <datalist id="lista-peneiras"><option value="Fina (1.0mm)"/><option value="Média (2.0mm)"/><option value="Grossa (3.0mm)"/></datalist>
            </div>
          </div>

          <div className="pt-2">
            {!fotoPreview ? (
              <div className="relative border-2 border-dashed border-slate-700 rounded-lg h-16 flex items-center justify-center hover:bg-slate-800 transition-colors">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Camera className="mr-2 h-5 w-5 text-slate-500" /> <span className="text-slate-500 text-sm">FOTO DO LOTE</span>
              </div>
            ) : (
              <div className="relative"><img src={fotoPreview} className="w-full h-32 object-cover rounded-lg border border-slate-700" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8" onClick={() => {setFotoArquivo(null); setFotoPreview(null);}}><X className="h-4 w-4"/></Button></div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "REGISTRAR LOTE"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
