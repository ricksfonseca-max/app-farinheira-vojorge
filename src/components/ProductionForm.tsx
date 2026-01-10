import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProductionFormData } from "@/types/production";

interface ProductionFormProps {
  onSubmit: (data: ProductionFormData) => void;
}

const tiposFarinha = ["BRANCA", "INTEGRAL", "ESPECIAL"];
const peneiras = ["BICA", "FINA", "GROSSA"];

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ProductionFormData>({
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    forno: "",
    umidade: "",
    tipoFarinha: "BRANCA",
    peneira: "BICA",
    responsavel: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate forno - must be a number
    const fornoNum = parseInt(formData.forno, 10);
    if (isNaN(fornoNum) || fornoNum <= 0) {
      toast({
        title: "Campo inválido",
        description: "O número do forno deve ser um valor numérico válido.",
        variant: "destructive",
      });
      return;
    }

    // Validate umidade - must be a valid number
    const umidadeNum = parseFloat(formData.umidade.replace(",", "."));
    if (isNaN(umidadeNum) || umidadeNum < 0 || umidadeNum > 100) {
      toast({
        title: "Campo inválido",
        description: "A % de umidade deve ser um valor entre 0 e 100.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      ...formData,
      forno: fornoNum.toString(),
      umidade: umidadeNum.toString(),
    });
    
    setFormData({
      ...formData,
      forno: "",
      umidade: "",
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleChange = (field: keyof ProductionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="animate-fade-in shadow-lg border-0">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="w-5 h-5" />
          Novo Registro de Produção
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="data" className="text-sm font-medium">Data</Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(e) => handleChange("data", e.target.value)}
              required
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hora" className="text-sm font-medium">Hora</Label>
            <Input
              id="hora"
              type="time"
              value={formData.hora}
              onChange={(e) => handleChange("hora", e.target.value)}
              required
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="forno" className="text-sm font-medium">Nº Forno *</Label>
            <Input
              id="forno"
              type="number"
              min="1"
              placeholder="Ex: 1, 2, 3"
              value={formData.forno}
              onChange={(e) => handleChange("forno", e.target.value)}
              required
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="umidade" className="text-sm font-medium">% Umidade *</Label>
            <Input
              id="umidade"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Ex: 9.27"
              value={formData.umidade}
              onChange={(e) => handleChange("umidade", e.target.value)}
              required
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoFarinha" className="text-sm font-medium">Tipo Farinha</Label>
            <Select value={formData.tipoFarinha} onValueChange={(value) => handleChange("tipoFarinha", value)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                {tiposFarinha.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="peneira" className="text-sm font-medium">Peneira</Label>
            <Select value={formData.peneira} onValueChange={(value) => handleChange("peneira", value)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                {peneiras.map((peneira) => (
                  <SelectItem key={peneira} value={peneira}>{peneira}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label htmlFor="responsavel" className="text-sm font-medium">Responsável</Label>
            <Input
              id="responsavel"
              type="text"
              placeholder="Nome do responsável"
              value={formData.responsavel}
              onChange={(e) => handleChange("responsavel", e.target.value)}
              required
              className="bg-card"
            />
          </div>

          <div className="col-span-2 md:col-span-1 flex items-end">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
