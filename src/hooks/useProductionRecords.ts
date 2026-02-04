import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, RegistroProducao } from "@/services/api";
import { toast } from "@/components/ui/use-toast"; // Verifica se o caminho do toast está certo

export function useProductionRecords() {
  const queryClient = useQueryClient();

  // 1. LISTAR (GET) - Busca automática e background refresh
  const { 
    data: records = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ["production-records"],
    queryFn: async () => {
      return await api.listar();
    },
    // Atualiza sozinho a cada 30 segundos
    refetchInterval: 30000, 
  });

  // 2. SALVAR (POST)
  const addRecordMutation = useMutation({
    mutationFn: async (newRecord: RegistroProducao) => {
      const sucesso = await api.salvar(newRecord);
      if (!sucesso) throw new Error("Erro ao salvar no servidor");
      return sucesso;
    },
    onSuccess: () => {
      // Força a atualização da lista imediatamente após salvar
      queryClient.invalidateQueries({ queryKey: ["production-records"] });
      toast({
        title: "Sucesso!",
        description: "Registro salvo no banco de dados.",
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Verifique a conexão com o Node-RED.",
        variant: "destructive",
      });
    },
  });

  // 3. DELETAR (DELETE) - Se precisares restaurar essa função
  // Nota: Precisas garantir que a tua api.ts tenha o método 'deletar' e o Node-RED tenha a rota DELETE
  /*
  const deleteRecordMutation = useMutation({
    mutationFn: async (id: number) => {
       // await api.deletar(id); // Precisas criar isso na api.ts se quiseres usar
       return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-records"] });
      toast({ title: "Registro apagado." });
    }
  });
  */

  // Wrapper para manter compatibilidade com teu código antigo
  const addRecord = async (data: RegistroProducao) => {
    try {
      await addRecordMutation.mutateAsync(data);
      return true;
    } catch {
      return false;
    }
  };

  return {
    records,
    isLoading,
    refetch,
    addRecord, // Agora podes usar addRecord no formulário como antes!
    // deleteRecord: deleteRecordMutation.mutateAsync 
  };
}
