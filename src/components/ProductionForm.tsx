import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const tiposFarinha = ["BRANCA", "INTEGRAL", "ESPECIAL"];
const peneiras = ["BICA", "FINA", "GROSSA"];

export function ProductionForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    forno: "",
    umidade: "",
    tipoFarinha: "BRANCA",
    peneira: "BICA",
    responsavel: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Tratamento de dados para o MySQL
    const payload = {
      ...formData,
      forno: parseInt(formData.forno),
      umidade: parseFloat(formData.umidade.replace(",", ".")),
    };

    try {
      await onSubmit(payload);
      setFormData({ ...formData, forno: "", umidade: "" });
      toast({ title: "Sucesso", description: "Dados registrados na Farinheira." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar no banco.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-l-8 border-l-green-600 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700">
          <ClipboardList className="text-green-600" /> Novo Registro de Produção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={formData.data} onChange={(e) => setFormData({...formData, data: e.target.value})} required />
          </div>
          <div className="space-y-1">
            <Label>Forno</Label>
            <Input type="number" placeholder="Ex: 1" value={formData.forno} onChange={(e) => setFormData({...formData, forno: e.target.value})} required />
          </div>
          <div className="space-y-1">
            <Label>Umidade %</Label>
            <Input placeholder="Ex: 12,5" value={formData.umidade} onChange={(e) => setFormData({...formData, umidade: e.target.value})} required />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input placeholder="Nome" value={formData.responsavel} onChange={(e) => setFormData({...formData, responsavel: e.target.value})} required />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={formData.tipoFarinha} onValueChange={(v) => setFormData({...formData, tipoFarinha: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{tiposFarinha.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Peneira</Label>
            <Select value={formData.peneira} onValueChange={(v) => setFormData({...formData, peneira: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{peneiras.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-end">
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Plus className="mr-2" />} Salvar Registro
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
