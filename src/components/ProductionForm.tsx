import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Camera, X, Loader2, Flame, Wheat, Droplets, Gauge, User, Building2, Package, Box, GripHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { TEXTO_ACAO, umidadeApi } from "@/services/umidade";

interface ProductionFormProps { onSubmit: () => void; }

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const [responsavel, setResponsavel] = useState(""); 
  const [umidade, setUmidade] = useState("");
  const [pressao, setPressao] = useState(""); 
  const [forno, setForno] = useState("");
  const [tipoFarinha, setTipoFarinha] = useState(""); 
  const [peneira, setPeneira] = useState("");
  const [cliente, setCliente] = useState("");
  const [produto, setProduto] = useState("");
  const [ensaque, setEnsaque] = useState("");
  
  // --- ESTADOS PARA OS HISTÓRICOS ---
  const [histOperadores, setHistOperadores] = useState<string[]>([]);
  const [histClientes, setHistClientes] = useState<string[]>([]);
  const [histProdutos, setHistProdutos] = useState<string[]>([]);
  const [histEnsaques, setHistEnsaques] = useState<string[]>([]);
  const [histFarinhas, setHistFarinhas] = useState<string[]>([]);
  const [histPeneiras, setHistPeneiras] = useState<string[]>([]);

  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = (key: string, defaults: string[]) => {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      return saved.length > 0 ? saved : defaults;
    };

    setHistOperadores(load("h_ope", []));
    setHistClientes(load("h_cli", ["Amafil", "Yoki", "Exportação"]));
    setHistProdutos(load("h_prod", ["Amido Nativo", "Fécula Premium"]));
    setHistEnsaques(load("h_ens", ["Saco 25Kg Valvulado", "Big Bag 1000Kg"]));
    setHistFarinhas(load("h_far", ["Branca", "Amarela", "Integral", "Biju"]));
    setHistPeneiras(load("h_pen", ["Fina (1.0mm)", "Média (2.0mm)", "Grossa (3.0mm)"]));

    const puxarPressao = async () => {
      try {
        const res = await fetch('https://api.fsk.tec.br/api/pressao-forno');
        const data = await res.json();
        if (data && data.pressao !== undefined) setPressao(data.pressao.toString());
      } catch (e) { console.error(e); }
    };
    puxarPressao();
    const interval = setInterval(puxarPressao, 5000);
    return () => clearInterval(interval);
  }, []);

  const atualizarHistorico = (lista: string[], valor: string, key: string) => {
    if (!valor) return lista;
    const novaLista = [valor, ...lista.filter(i => i !== valor)].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(novaLista));
    return novaLista;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsavel || !umidade || !pressao || !forno || !tipoFarinha || !peneira) {
      toast({ variant: "destructive", title: "Atenção", description: "Preencha os campos obrigatórios." }); return;
    }
    setIsSubmitting(true);
    try {
      let fotoString = ""; 
      if (fotoArquivo) {
        fotoString = await new Promise((res) => {
          const r = new FileReader(); r.readAsDataURL(fotoArquivo); r.onload = () => res(r.result as string);
        });
      }
      
      const hora = new Date().getHours();
      let turno = 3; 
      if (hora >= 6 && hora < 14) turno = 1;
      else if (hora >= 14 && hora < 22) turno = 2;

      const dataHora = new Date().toISOString();
      const sucesso = await api.salvar({
        responsavel, umidade: parseFloat(umidade), pressao: parseFloat(pressao),
        forno, tipo_farinha: tipoFarinha, peneira, foto: fotoString,
        turno_num: turno, cliente, produto, ensaque, data_hora: dataHora
      });

      if (sucesso) {
        setHistOperadores(atualizarHistorico(histOperadores, responsavel, "h_ope"));
        setHistClientes(atualizarHistorico(histClientes, cliente, "h_cli"));
        setHistProdutos(atualizarHistorico(histProdutos, produto, "h_prod"));
        setHistEnsaques(atualizarHistorico(histEnsaques, ensaque, "h_ens"));
        setHistFarinhas(atualizarHistorico(histFarinhas, tipoFarinha, "h_far"));
        setHistPeneiras(atualizarHistorico(histPeneiras, peneira, "h_pen"));

        toast({ title: "Sucesso!", description: "Dados registrados." });

        // Envia a amostra ao serviço de controle e mostra a sugestão de rotação.
        // Se o serviço estiver fora, o apontamento já foi salvo e ele sincroniza depois pelo Node-RED.
        umidadeApi
          .registrarAmostra({ forno, umidade: parseFloat(umidade), data_hora: dataHora, tipo_farinha: tipoFarinha, peneira, responsavel })
          .then(({ sugestao: s }) => {
            if (!s) return;
            const hz = s.velocidade_sugerida_hz !== null ? ` → ${s.velocidade_sugerida_hz.toFixed(1)} Hz` : "";
            toast({ title: `${forno}: ${TEXTO_ACAO[s.acao] ?? s.acao}${hz}`, description: s.motivo, duration: 20000 });
            onSubmit();
          })
          .catch((e) => console.warn("Serviço de umidade indisponível:", e));

        setUmidade(""); setFotoArquivo(null); setFotoPreview(null); onSubmit();
      } else {
        toast({
          variant: "destructive",
          title: "NÃO foi salvo",
          description: "Sem conexão com o servidor. Confira a rede e toque em Registrar de novo.",
        });
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
            <Label className="text-xs font-bold text-slate-400 uppercase">Operador</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} list="l-ope" className="bg-slate-900 border-slate-700 text-slate-100" placeholder="Seu nome..." required />
            <datalist id="l-ope">{histOperadores.map(h => <option key={h} value={h} />)}</datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Cliente</Label>
              <Input value={cliente} onChange={(e) => setCliente(e.target.value)} list="l-cli" className="bg-slate-900 border-slate-700" placeholder="Histórico..." />
              <datalist id="l-cli">{histClientes.map(h => <option key={h} value={h} />)}</datalist>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Produto</Label>
              <Input value={produto} onChange={(e) => setProduto(e.target.value)} list="l-prod" className="bg-slate-900 border-slate-700" placeholder="Histórico..." />
              <datalist id="l-prod">{histProdutos.map(h => <option key={h} value={h} />)}</datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-400 uppercase">Ensaque</Label>
            <Input value={ensaque} onChange={(e) => setEnsaque(e.target.value)} list="l-ens" className="bg-slate-900 border-slate-700" placeholder="Histórico..." />
            <datalist id="l-ens">{histEnsaques.map(h => <option key={h} value={h} />)}</datalist>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-800/50">
            <div className="space-y-2 text-center border-r border-slate-800">
              <Label className="text-xs font-bold text-cyan-400 uppercase">Umidade (%)</Label>
              <Input type="number" step="0.1" value={umidade} onChange={(e) => setUmidade(e.target.value)} className="h-12 text-xl text-center font-bold bg-slate-900 border-slate-700 text-cyan-400" required />
            </div>
            <div className="space-y-2 text-center">
              <Label className="text-xs font-bold text-orange-400 uppercase">Pressão</Label>
              <Input type="number" step="0.1" value={pressao} onChange={(e) => setPressao(e.target.value)} className="h-12 text-xl text-center font-bold bg-slate-800 border-orange-500/50 text-orange-400" required />
            </div>
          </div>

          <div className="grid gap-3">
            <Select value={forno} onValueChange={setForno}>
              <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Selecione o Forno" /></SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100 border-slate-700"><SelectItem value="Forno 01">Forno 01</SelectItem><SelectItem value="Forno 02">Forno 02</SelectItem></SelectContent>
            </Select>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Tipo de Farinha</Label>
              <Input value={tipoFarinha} onChange={(e) => setTipoFarinha(e.target.value)} list="l-far" className="bg-slate-900 border-slate-700" placeholder="Branca, Amarela..." required />
              <datalist id="l-far">{histFarinhas.map(h => <option key={h} value={h} />)}</datalist>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Peneira</Label>
              <Input value={peneira} onChange={(e) => setPeneira(e.target.value)} list="l-pen" className="bg-slate-900 border-slate-700" placeholder="Peneira (Ex: 1.0mm)" required />
              <datalist id="l-pen">{histPeneiras.map(h => <option key={h} value={h} />)}</datalist>
            </div>
          </div>

          <div className="pt-2">
            {!fotoPreview ? (
              <div className="relative border-2 border-dashed border-slate-700 rounded-lg h-16 flex items-center justify-center hover:bg-slate-800 transition-colors">
                <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                  const f = e.target.files?.[0]; if(f){setFotoArquivo(f); setFotoPreview(URL.createObjectURL(f));}
                }} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Camera className="mr-2 h-5 w-5 text-slate-500" /> <span className="text-slate-500 text-sm font-bold">FOTO DO LOTE</span>
              </div>
            ) : (
              <div className="relative"><img src={fotoPreview} className="w-full h-32 object-cover rounded-lg border border-slate-700" />
              <button type="button" className="absolute top-2 right-2 bg-red-600 rounded-full p-1" onClick={() => {setFotoArquivo(null); setFotoPreview(null);}}><X className="h-4 w-4"/></button></div>
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
