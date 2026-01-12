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
import { Plus, Loader2 } from "lucide-react";
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
        title: "Erro",
        description: "Forno inválido.",
        variant: "destructive",
      });
      return;
    }

    // Tratamento da Vírgula -> Ponto
    const umidadeNum = parseFloat(formData.umidade.replace(",", "."));
    if (isNaN(umidadeNum) || umidadeNum < 0 || umidadeNum > 100) {
      toast({
        title: "Erro",
        description: "Umidade inválida (0-100).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // --- LÓGICA DE URL INTELIGENTE ---
      // Pega o domínio atual onde o site está rodando
      const domain = window.location.origin;

      // Se estiver rodando local (localhost), aponta para a API na porta 1880 (Node-RED)
      // Se estiver em produção (https://fsk.tec.com.br), usa a mesma base
      const baseUrl = domain.includes("localhost")
        ? "http://localhost:1880" // Ajuste se seu Node-RED local usar outra porta ou IP
        : "https://fsk.tec.com.br"; // URL da VPS

      const API_URL = `${baseUrl}/api/registrar-producao`;

      console.log("Enviando para:", API_URL);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          umidade: umidadeNum,
          forno: formData.forno,
        }),
      });

      if (!response.ok) throw new Error("Erro no servidor");

      toast({
        title: "Sucesso!",
        description: "Dados salvos na fábrica.",
        variant: "default",
      });

      // Limpa e Atualiza
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
        description: "Verifique se a VPS/Node-RED está rodando.",
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
    <Card className="animate-fade-in shadow-lg border-0">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="w-5 h-5" /> Novo Registro
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={formData.data}
              onChange={(e) => handleChange("data", e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input
              id="hora"
              type="time"
              value={formData.hora}
              onChange={(e) => handleChange("hora", e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forno">Forno</Label>
            <Input
              id="forno"
              type="number"
              value={formData.forno}
              onChange={(e) => handleChange("forno", e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Ex: 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="umidade">Umidade %</Label>
            <Input
              id="umidade"
              inputMode="decimal"
              value={formData.umidade}
              onChange={(e) => handleChange("umidade", e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Ex: 12.5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipoFarinha">Tipo</Label>
            <Select
              value={formData.tipoFarinha}
              onValueChange={(v) => handleChange("tipoFarinha", v)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {tiposFarinha.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="peneira">Peneira</Label>
            <Select
              value={formData.peneira}
              onValueChange={(v) => handleChange("peneira", v)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {peneiras.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => handleChange("responsavel", e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}{" "}
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
