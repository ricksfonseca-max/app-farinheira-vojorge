import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// ☢️ NOVA ROTA: Isso força o sistema a ignorar qualquer cache antigo
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/industrial";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // --- BUSCAR DADOS (GET) ---
  const fetchRecords = async () => {
    try {
      // ?t=... Truque Anti-Cache
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      if (!response.ok) return;

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
      console.error("Erro GET:", error);
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

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "SISTEMA ATUALIZADO 🚀", 
          description: "Registro salvo na nova rota Industrial.",
          className: "bg-green-600 text-white border-none"
        });
        
        // Atualização forçada dupla
        setTimeout(() => fetchRecords(), 500); 
        setTimeout(() => fetchRecords(), 1500); 
        return true;
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
      return false;
    }
  };

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
