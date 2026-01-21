import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

// Interface completa com TODOS os dados
export interface ProductionRecord {
  id: number;
  data: string;
  hora: string;
  umidade: number;
  forno: string;
  tipoFarinha: string; // Restaurado
  peneira: string;     // Restaurado (A Bica)
  responsavel: string;
  foto?: string;       // A Foto
}

// Interface para o envio (sem id/data/hora pois geramos no envio)
export interface ProductionFormData {
  umidade: number;
  forno: string;
  tipoFarinha: string;
  peneira: string;
  foto?: string;
}

// URL DO NODE-RED (Se estiver usando dominio novo):
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. BUSCAR DADOS
  const fetchRecords = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Erro Node-RED:", error);
      // Evita spam de erro se já tiver dados na tela
      if (records.length === 0) {
        toast({ title: "Aguardando conexão...", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 15000); // Atualiza a cada 15s
    return () => clearInterval(interval);
  }, []);

  // 2. SALVAR DADOS (Agora recebe o objeto completo)
  const addRecord = async (formData: ProductionFormData, usuario: string) => {
    const now = new Date();
    const dataAtual = now.toISOString().split('T')[0];
    const horaAtual = now.toTimeString().split(' ')[0];

    // Monta o pacote completo para o Node-RED
    const payload = {
      data: dataAtual,
      hora: horaAtual,
      usuario: usuario,
      responsavel: usuario,
      ...formData // Espalha: umidade, forno, tipoFarinha, peneira, foto
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "Salvo com sucesso!", 
          className: "bg-green-600 text-white border-none"
        });
        fetchRecords(); 
        return true;
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (error) {
      toast({ title: "Erro ao salvar", description: "Verifique a conexão.", variant: "destructive" });
      return false;
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
