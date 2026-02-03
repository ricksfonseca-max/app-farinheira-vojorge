import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// 👇 COLE O SEU ENDEREÇO NOVO AQUI (Mantenha o /api/industrial no final)
const API_URL = "https://nodered-v2.fsk.tec.br/api/industrial"; 

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // --- BUSCAR DADOS (GET) ---
  const fetchRecords = async () => {
    try {
      // ?t=... Truque Anti-Cache (Garante que vê os dados reais)
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      
      if (!response.ok) {
         // Se der erro 404, é porque a URL está errada
         console.error("Erro na conexão:", response.status);
         return;
      }
      
      const rawData = await response.json();

      if (!Array.isArray(rawData)) return;

      const formattedData = rawData.map((item: any) => ({
        id: item.id,
        tipoFarinha: item.tipo_farinha || item.tipoFarinha || "Padrão", 
        data: item.data_registro || item.data || new Date().toISOString(),
        hora: item.hora_registro || item.hora || "00:00",
        umidade: Number(item.umidade || 0),
        forno: item.forno || "Geral",
        peneira: item.peneira || "Bica 1",
        responsavel: item.responsavel || "Sistema",
        foto: item.foto || null
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error("Erro Fatal no GET:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- SALVAR DADOS (POST) ---
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">) => {
    if (!user) {
      toast({ title: "Erro", description: "Faça login.", variant: "destructive" });
      return false;
    }

    try {
      const payload = {
        ...formData,
        responsavel: user.name,
        usuario: user.name,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0]
      };

      console.log("Enviando para Fábrica Nova:", payload);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "FÁBRICA V2 CONECTADA 🏭", 
          description: "Registro salvo no banco novo!",
          className: "bg-blue-600 text-white border-none" // Azul para diferenciar
        });
        
        // Atualiza a lista duas vezes para garantir
        setTimeout(() => fetchRecords(), 500); 
        setTimeout(() => fetchRecords(), 1500); 
        return true;
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", description: "Verifique a URL da API.", variant: "destructive" });
      return false;
    }
  };

  // --- DELETAR ---
  const deleteRecord = async (id: number) => {
    await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    });
    toast({ title: "Apagado" });
    fetchRecords();
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 5000); 
    return () => clearInterval(interval);
  }, []);

  return { records, loading, addRecord, deleteRecord, refresh: fetchRecords };
}
