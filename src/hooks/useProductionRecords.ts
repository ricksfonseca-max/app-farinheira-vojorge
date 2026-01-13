import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// ✅ URL OFICIAL DA INDÚSTRIA VÔ JORGE CONECTADA:
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. BUSCAR DADOS (GET)
  const fetchRecords = async () => {
    try {
      // setLoading(true); // Comentado para evitar piscar a tela em atualizações silenciosas
      const response = await fetch(API_URL);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Erro na conexão com Node-RED:", error);
      // Só mostra erro se a lista estiver vazia para não incomodar o operador
      if (records.length === 0) {
        toast({ 
          title: "Sem conexão com a Fábrica", 
          description: "Verifique se o Node-RED está rodando.", 
          variant: "destructive" 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Carrega os dados assim que a tela abre
  useEffect(() => {
    fetchRecords();
    
    // Opcional: Atualiza a cada 30 segundos automaticamente (bom para dashboards)
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. SALVAR DADOS (POST)
  const addRecord = async (formData: ProductionFormData) => {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({ 
          title: "Sucesso!", 
          description: "Registro de produção salvo no servidor.",
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); // Atualiza a tabela imediatamente
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      toast({ 
        title: "Erro ao Salvar", 
        description: "Não foi possível conectar ao banco de dados.",
        variant: "destructive" 
      });
    }
  };

  // 3. APAGAR DADOS (DELETE)
  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({ title: "Registro removido com sucesso." });
        fetchRecords(); // Atualiza a tabela
      }
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  return { records, loading, addRecord, deleteRecord };
}
