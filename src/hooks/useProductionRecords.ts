import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ProductionFormData, ProductionRecord } from "@/types/production";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchRecords = async () => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("production_records")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((r) => ({
        id: r.id,
        data: r.data,
        hora: r.hora,
        forno: r.forno,
        umidade: Number(r.umidade),
        tipoFarinha: r.tipo_farinha,
        peneira: r.peneira,
        responsavel: r.responsavel,
        createdAt: r.created_at,
      }));

      setRecords(mapped);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({
        title: "Erro ao carregar registros",
        description: "Não foi possível carregar os registros.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user]);

  const addRecord = async (formData: ProductionFormData) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("production_records").insert({
        user_id: user.id,
        data: formData.data,
        hora: formData.hora,
        forno: formData.forno,
        umidade: parseFloat(formData.umidade),
        tipo_farinha: formData.tipoFarinha,
        peneira: formData.peneira,
        responsavel: formData.responsavel,
      });

      if (error) throw error;

      toast({
        title: "Registro adicionado",
        description: `Registro do forno ${formData.forno} salvo com sucesso.`,
      });

      fetchRecords();
    } catch (error) {
      console.error("Error adding record:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o registro.",
        variant: "destructive",
      });
    }
  };

  const deleteRecord = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("production_records")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Registro removido",
        description: "O registro foi removido com sucesso.",
        variant: "destructive",
      });

      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    }
  };

  return {
    records,
    loading,
    addRecord,
    deleteRecord,
  };
}
