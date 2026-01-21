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

      // --- CORREÇÃO DE MAPEAMENTO ---
      // O banco manda 'tipo_farinha', nós convertemos para 'tipoFarinha'
      const formattedData = rawData.map((item: any) => ({
        ...item,
        tipoFarinha: item.tipo_farinha || item.tipoFarinha || "Não Informado", // Garante que apareça
        peneira: item.peneira || "Bica ??"
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error("Erro Node-RED:", error);
      if (records.length === 0) {
        toast({ title: "Sem conexão", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 15000);
    return () => clearInterval(interval);
  }, []);

  // 2. SALVAR
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">) => {
    if (!user) return;

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
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); 
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
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
