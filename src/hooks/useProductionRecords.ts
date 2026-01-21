import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // 1. BUSCAR DADOS
  const fetchRecords = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      
      const rawData = await response.json();

      // Corrige mapeamento (tipo_farinha -> tipoFarinha)
      const formattedData = rawData.map((item: any) => ({
        ...item,
        tipoFarinha: item.tipo_farinha || item.tipoFarinha || "Não Informado",
        peneira: item.peneira || "Bica ??"
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error("Erro Node-RED:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 15000);
    return () => clearInterval(interval);
  }, []);

  // 2. SALVAR (Agora retorna TRUE ou FALSE)
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">): Promise<boolean> => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário desconectado", variant: "destructive" });
      return false;
    }

    const payload = {
      ...formData,
      usuario: user.name,
      responsavel: user.name
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "Sucesso!", 
          description: "Registro e foto enviados.",
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); // Atualiza a lista
        return true; // <--- AVISA QUE DEU CERTO
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
      return false; // <--- AVISA QUE DEU ERRO
    }
  };

  // 3. DELETAR
  const deleteRecord = async (id: number) => {
    try {
      await fetch(`${API_URL}?id=${id}`, { method: "DELETE" });
      toast({ title: "Apagado." });
      fetchRecords();
    } catch (error) {
      console.error(error);
    }
  };

  return { records, loading, addRecord, deleteRecord };
}
