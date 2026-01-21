import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";

export interface ProductionRecord {
  id: number;
  data: string; // Formato YYYY-MM-DD
  hora: string; // Formato HH:MM:SS
  umidade: number;
  forno: string;
  responsavel: string;
  foto?: string; // Campo opcional para a imagem Base64
}

// URL da API (ajuste se estiver usando localhost ou dominio)
const API_BASE = "https://api.fsk.tec.br/api"; 
// Se ainda estiver testando local sem dominio, use o IP: "http://SEU_IP:1880/api"

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar registros
  const fetchRecords = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/producao`);
      if (!response.ok) throw new Error("Erro ao buscar dados");
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Erro ao carregar registros:", error);
      toast({ 
        variant: "destructive", 
        title: "Erro de Conexão", 
        description: "Não foi possível carregar o histórico." 
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Adicionar novo registro (AGORA COM FOTO)
  const addRecord = async (umidade: number, forno: string, usuario: string, foto: string = "") => {
    // Pegar Data e Hora atuais do dispositivo
    const now = new Date();
    const dataAtual = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaAtual = now.toTimeString().split(' ')[0]; // HH:MM:SS

    try {
      const response = await fetch(`${API_BASE}/producao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: dataAtual,
          hora: horaAtual,
          umidade,
          forno,
          usuario,      // Quem está enviando
          responsavel: usuario, // Redundância para garantir
          foto          // A string gigante da imagem
        }),
      });

      if (!response.ok) throw new Error("Erro ao salvar no servidor");

      // Atualiza a lista localmente para parecer instantâneo
      await fetchRecords();
      
      return true; // Sucesso
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Erro ao Salvar", 
        description: "Verifique sua conexão e tente novamente." 
      });
      return false; // Falha
    }
  };

  // Carrega os dados ao abrir a tela
  useEffect(() => {
    fetchRecords();
    // Atualiza a cada 30 segundos automaticamente
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  return { records, addRecord, loading, reload: fetchRecords };
}
