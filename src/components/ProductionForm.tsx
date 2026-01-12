import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProductionFormData } from "@/types/production";

interface ProductionFormProps {
  onSubmit: (data: ProductionFormData) => void;
}

const tiposFarinha = ["BRANCA", "INTEGRAL", "ESPECIAL"];
const peneiras = ["BICA", "FINA", "GROSSA"];

export function ProductionForm({ onSubmit }: ProductionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ProductionFormData>({
    data: new Date().toISOString().split("T")[0],
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    forno: "",
    umidade: "",
    tipoFarinha: "BRANCA",
    peneira: "BICA",
    responsavel: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- VALIDAÇÕES ---
    const fornoNum = parseInt(formData.forno, 10);
    if (isNaN(fornoNum) || fornoNum <= 0) {
      toast({
        title: "Erro no Forno",
        description: "Por favor, insira um número de forno válido.",
        variant: "destructive",
      });
      return;
    }

    // Tratamento da Vírgula -> Ponto para Umidade
    const umidadeNum = parseFloat(formData.umidade.replace(",", "."));
    if (isNaN(umidadeNum) || umidadeNum < 0 || umidadeNum > 100) {
      toast({
        title: "Erro na Umidade",
        description: "A umidade deve estar entre 0 e 100%.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // --- LÓGICA DE URL INTELIGENTE ---
      const domain = window.location.origin;
      const baseUrl = domain.includes("localhost")
        ? "http://localhost:1880" 
        : "https://app-farinheira.fsk.tec.br"; // Sua URL da VPS

      const API_URL = `${baseUrl}/api/registrar-producao`;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          umidade: umidadeNum,
          forno: formData.forno,
          origem: "App Indústria Vô Jorge"
        }),
      });

      if (!response.ok) throw new Error("Erro no servidor");

      toast({
        title: "Sucesso!",
        description: "Dados salvos no sistema da fábrica.",
      });

      // Notifica o componente pai e limpa os campos variáveis
      onSubmit({ ...formData, umidade: umidadeNum.toString() });
      setFormData({
        ...formData,
        forno: "",
        umidade: "",
        hora: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro de Conexão",
        description: "O banco de dados ou Node-RED parece estar offline.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof ProductionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="animate-fade-in shadow-xl border-t-4 border-t-green-600">
      <CardHeader className="bg-slate-50 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <ClipboardCheck className="w-6 h-6 text-green-600" /> 
          Indústria Vô Jorge - Registro
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label htmlFor="data" className="font-bold text-slate-600">Data</Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(e) => handleChange("data", e.target.value)}
              required
              disabled={isSubmitting}
              className="rounded-lg border-slate-200 focus:ring-green-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hora" className="font-bold text-slate-600">Hora</Label>
            <Input
              id="hora"
              type="time"
              value={formData.hora}
              onChange={(e) => handleChange("hora", e.target.value)}
              required
              disabled={isSubmitting}
              className="rounded-lg border-slate-200 focus:ring-green-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forno" className="font-bold text-slate-600">Forno</Label>
            <Input
              id="forno"
              type="number"
              value={formData.forno}
              onChange={(e) => handleChange("forno", e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Nº Forno"
              className="rounded-lg border-slate-200 focus:ring-green-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="umidade" className="font-bold text-slate-600">Umidade (%)</Label>
            <Input
              id="umidade"
              inputMode="decimal"
              value={formData.umidade}
              onChange={(e) => handleChange("umidade", e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Ex: 13,5"
              className="rounded-lg border-slate-200 focus:ring-green-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipoFarinha" className="font-bold text-slate-600">Tipo Farinha</Label>
            <Select
              value={formData.tipoFarinha}
              onValueChange={(v) => handleChange("tipoFarinha", v)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="rounded-lg border-slate-200">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {tiposFarinha.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="peneira" className="font-bold text-slate-600">Peneira</Label>
            <Select
              value={formData.peneira}
              onValueChange={(v) => handleChange("peneira", v)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="rounded-lg border-slate-200">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {peneiras.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label htmlFor="responsavel" className="font-bold text-slate-600">Responsável</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => handleChange("responsavel", e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Nome do operador"
              className="rounded-lg border-slate-200 focus:ring-green-500"
            />
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700 font-bold py-6 rounded-lg transition-all shadow-md active:scale-95" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Plus className="w-5 h-5 mr-2" />
              )}{" "}
              SALVAR REGISTRO
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
