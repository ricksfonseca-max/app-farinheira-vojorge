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
      // 🚀 TRUQUE ANTI-CACHE: Adicionamos ?t=agora para forçar o navegador a buscar novos dados
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      
      if (!response.ok) throw new Error("Falha na conexão");
      
      const rawData = await response.json();

      if (!Array.isArray(rawData)) {
        console.error("Recebido algo que não é lista:", rawData);
        return;
      }

      // Mapeamento Blindado (Trata nulos e undefined)
      const formattedData = rawData.map((item: any) => ({
        id: item.id,
        // Garante que se o banco mandar snake_case, a gente pega
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
          title: "Sucesso! 💾", 
          description: "Registro salvo no banco.",
          className: "bg-green-600 text-white border-none"
        });
        // Espera 500ms para o banco processar antes de recarregar a lista
        setTimeout(fetchRecords, 500); 
        return true;
      } else {
        throw new Error("Servidor recusou");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
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
      setTimeout(fetchRecords, 500);
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRecords();
    // Atualiza a cada 5 segundos (mais rápido para você ver o resultado)
    const interval = setInterval(fetchRecords, 5000); 
    return () => clearInterval(interval);
  }, []);

  return { records, loading, addRecord, deleteRecord, refresh: fetchRecords };
}
