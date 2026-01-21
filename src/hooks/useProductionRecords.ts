import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth"; // Importamos o Auth para pegar o nome
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// ✅ URL OFICIAL
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); // Pegamos o usuário logado

  // 1. BUSCAR DADOS (GET)
  const fetchRecords = async () => {
    try {
      const response = await fetch(API_URL);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Erro na conexão com Node-RED:", error);
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

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. SALVAR DADOS (POST)
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não logado.", variant: "destructive" });
      return;
    }

    // Injeta o nome do usuário e a data/hora automática no pacote
    const payload = {
      ...formData,
      usuario: user.name, // Garante que o nome vai
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
          description: "Registro salvo com evidência.",
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); // Atualiza a tabela imediatamente
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      toast({ 
        title: "Erro ao Salvar", 
        description: "Não foi possível conectar ao servidor.",
        variant: "destructive" 
      });
    }
  };

  // 3. APAGAR DADOS (DELETE)
  const deleteRecord = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({ title: "Registro removido com sucesso." });
        fetchRecords(); 
      }
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  return { records, loading, addRecord, deleteRecord };
}
