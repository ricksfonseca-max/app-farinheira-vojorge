import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, RegistroProducao } from "@/services/api";
import { toast } from "./use-toast";

export function useProductionRecords() {
  const queryClient = useQueryClient();

  // Buscar registros (GET)
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["production-records"],
    queryFn: async () => {
      console.log("Buscando dados no Node-RED...");
      return await api.listar();
    },
  });

  // Salvar novo registro (POST)
  const addRecord = useMutation({
    mutationFn: async (newRecord: RegistroProducao) => {
      const sucesso = await api.salvar(newRecord);
      if (!sucesso) throw new Error("Erro ao salvar");
      return sucesso;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-records"] });
      toast({
        title: "Registro salvo",
        description: "Os dados foram enviados para o servidor industrial.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    },
  });

  return {
    records,
    isLoading,
    addRecord,
  };
}
