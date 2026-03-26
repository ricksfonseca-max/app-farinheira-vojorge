import { useState, useEffect } from 'react';

export function useProductionRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://api.fsk.tec.br/api/registros');
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error("Erro ao buscar registros globais:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { records, isLoading, refetch };
}
