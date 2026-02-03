import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// 🔗 MESMA URL DO NODE-RED V3
const API_URL = "https://nodered-vojorge.fsk.tec.br/api";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // --- BUSCAR DADOS (GET) ---
  const fetchRecords = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Falha na conexão");
      
      const rawData = await response.json();

      // Mapeia os dados do Postgres (snake_case) para o React (camelCase)
      const formattedData = rawData.map((item: any) => ({
        ...item,
        // Garante que o App entenda os campos do banco
        tipoFarinha: item.tipo_farinha || item.tipoFarinha, 
        data: item.data_registro || item.data,
        hora: item.hora_registro || item.hora
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error("Erro ao buscar:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- SALVAR DADOS (POST) ---
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return false;
    }

    try {
      // Monta o pacote para enviar
      const payload = {
        ...formData,
        responsavel: user.name, // Quem está logado
        usuario: user.name,
        // Garante data/hora local se não vier do form
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0]
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "Registro Salvo! 💾", 
          description: "Dados sincronizados com o Banco Industrial.",
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); // Atualiza a tabela na hora
        return true;
      } else {
        throw new Error("Servidor recusou");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", description: "Tente novamente.", variant: "destructive" });
      return false;
    }
  };

  // --- DELETAR (DELETE) ---
  const deleteRecord = async (id: number) => {
    try {
      await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }) // Envia o ID para deletar
      });
      
      toast({ title: "Apagado", description: "Registro removido." });
      fetchRecords(); // Atualiza a lista
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRecords();
    // Atualiza a cada 15 segundos automaticamente
    const interval = setInterval(fetchRecords, 15000); 
    return () => clearInterval(interval);
  }, []);

  return { records, loading, addRecord, deleteRecord, refresh: fetchRecords };
}
