import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

// 🔴 IMPORTANTE: Coloque aqui o link do seu Node-RED da VPS
const API_URL = "https://nodered-v2.fsk.tec.br/api/industrial"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const { user } = useAuth();

  // Função para Buscar
  const fetchRecords = async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        // Converte o formato do banco (snake_case) para o App (camelCase)
        setRecords(data.map((r: any) => ({
          ...r,
          tipoFarinha: r.tipo_farinha, // Tradução importante
          umidade: Number(r.umidade)
        })));
      }
    } catch (e) { console.error("Erro ao buscar", e); }
  };

  // Função para Salvar
  const addRecord = async (formData: any) => {
    try {
      const payload = {
        ...formData,
        responsavel: user?.name || "Operador",
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR')
      };

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      toast({ title: "Sucesso", description: "Registro Salvo na VPS!" });
      fetchRecords(); // Atualiza a lista
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Erro de Conexão" });
      return false;
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  return { records, loading: false, addRecord, deleteRecord: async () => {} };
}
