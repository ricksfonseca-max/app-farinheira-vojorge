import { useState, useEffect } from "react";
import type { ProductionFormData, ProductionRecord } from "@/types/production";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // URL Inteligente: Detecta se está local ou na VPS
  const API_URL = window.location.origin.includes("localhost")
    ? "http://localhost:1880/api/producao"
    : "/api/producao"; // No Easypanel, o Proxy cuidará do redirecionamento

  const fetchRecords = async () => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Falha ao buscar dados no MySQL");
      
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({
        title: "Erro no MySQL",
        description: "Não foi possível carregar os dados da farinheira.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user]);

  const addRecord = async (formData: ProductionFormData) => {
    if (!user) return;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          usuario_id: user.id, // Vincula o registro ao operador
          unidade: "Indústria Vô Jorge"
        }),
      });

      if (!response.ok) throw new Error("Erro ao salvar no MySQL");

      toast({
        title: "Sucesso!",
        description: `Produção do forno ${formData.forno} registrada.`,
      });

      fetchRecords(); // Atualiza a tabela
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Verifique a conexão com o banco de dados da fábrica.",
        variant: "destructive",
      });
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao deletar");

      toast({
        title: "Removido",
        description: "Registro excluído do MySQL.",
        variant: "destructive",
      });

      fetchRecords();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    }
  };

  return { records, loading, addRecord, deleteRecord };
}
