import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useProductionRecords() {
  // O 'refetch' é a função mágica que força a atualização da lista
  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ["production-records"],
    queryFn: async () => {
      return await api.listar();
    },
    // Atualiza sozinho a cada 30 segundos (opcional)
    refetchInterval: 30000, 
  });

  return {
    records,
    isLoading,
    refetch, // <--- EXPORTANDO O REFRESH
  };
}
