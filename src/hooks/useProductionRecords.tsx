import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// 🔗 URL de Produção
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // --- BUSCAR DADOS (GET) ---
  const fetchRecords = async () => {
    try {
      const timeStamp = Date.now();
      // ?t=... obriga o navegador a não usar cache
      const response = await fetch(`${API_URL}?t=${timeStamp}`);
      
      if (!response.ok) {
        console.error(`Erro GET: ${response.status} - ${response.statusText}`);
        return;
      }
      
      const rawData = await response.json();

      if (!Array.isArray(rawData)) {
        // Se vier { error: ... } mostra no console
        console.error("GET retornou erro ou formato inválido:", rawData);
        return;
      }

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

      // Só atualiza se tiver dados diferentes (evita piscar a tela)
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
      toast({ title: "Erro de Permissão", description: "Faça login novamente.", variant: "destructive" });
      return false;
    }

    try {
      // Prepara o pacote
      const payload = {
        ...formData,
        responsavel: user.name,
        usuario: user.name,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0]
      };

      console.log("Enviando POST:", payload); // DEBUG

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "Sucesso! (v3) 🚀", 
          description: "Registro salvo no banco.",
          className: "bg-green-600 text-white border-none"
        });
        
        // Estratégia de Atualização Dupla (Garante que a lista atualize)
        setTimeout(() => fetchRecords(), 500); 
        setTimeout(() => fetchRecords(), 2000); 
        return true;
      } else {
        // Tenta ler o erro que o servidor mandou
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro POST:", response.status, errorData);
        throw new Error(errorData.error || "Servidor recusou a gravação");
      }
    } catch (error: any) {
      console.error("Erro no addRecord:", error);
      toast({ 
        title: "Falha ao Salvar", 
        description: error.message || "Verifique sua conexão.", 
        variant: "destructive" 
      });
      return false;
    }
  };

  // --- DELETAR (DELETE) ---
  const deleteRecord = async (id: number) => {
    try {
      await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      
      toast({ title: "Apagado", description: "Registro removido." });
      setTimeout(fetchRecords, 1000);
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 5000); 
    return () => clearInterval(interval);
  }, []);

  return { records, loading, addRecord, deleteRecord, refresh: fetchRecords };
}
