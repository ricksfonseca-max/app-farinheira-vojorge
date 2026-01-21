import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

// Definindo a interface aqui para garantir que o campo foto exista
export interface ProductionRecord {
  id: number;
  data: string;
  hora: string;
  umidade: number;
  forno: string;
  responsavel: string;
  foto?: string; // <--- NOVO CAMPO
}

// URL da API (Ajuste se estiver usando o domínio novo do Cloudflare ou mantenha o antigo se estiver funcionando)
// Recomendado usar o novo se configurou: "https://api.fsk.tec.br/api/producao"
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
          title: "Sem conexão", 
          description: "Verifique se o servidor está rodando.", 
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

  // 2. SALVAR DADOS (POST) - ATUALIZADO COM FOTO
  // Agora aceita argumentos individuais para facilitar o envio da foto
  const addRecord = async (umidade: number, forno: string, usuario: string, foto: string = "") => {
    
    // Pega data/hora do momento do clique
    const now = new Date();
    const dataAtual = now.toISOString().split('T')[0];
    const horaAtual = now.toTimeString().split(' ')[0];

    const payload = {
      data: dataAtual,
      hora: horaAtual,
      umidade,
      forno,
      usuario,
      responsavel: usuario,
      foto // <--- ENVIA A FOTO
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
        return true;
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      toast({ 
        title: "Erro ao Salvar", 
        description: "Não foi possível conectar ao servidor.",
        variant: "destructive" 
      });
      return false;
    }
  };

  // 3. APAGAR DADOS (DELETE)
  const deleteRecord = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({ title: "Registro removido." });
        fetchRecords();
      }
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  return { records, loading, addRecord, deleteRecord };
}
