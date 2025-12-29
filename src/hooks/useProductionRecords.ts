import { useState, useEffect } from "react";
import type { ProductionRecord, ProductionFormData } from "@/types/production";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "production_records";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecords(parsed);
      } catch (error) {
        console.error("Error loading records:", error);
      }
    }
  }, []);

  const saveToStorage = (newRecords: ProductionRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
  };

  const addRecord = (data: ProductionFormData) => {
    const newRecord: ProductionRecord = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    const newRecords = [newRecord, ...records];
    setRecords(newRecords);
    saveToStorage(newRecords);

    toast({
      title: "Registro adicionado",
      description: `Registro do forno ${data.forno} salvo com sucesso.`,
    });
  };

  const deleteRecord = (id: string) => {
    const newRecords = records.filter(record => record.id !== id);
    setRecords(newRecords);
    saveToStorage(newRecords);

    toast({
      title: "Registro removido",
      description: "O registro foi removido com sucesso.",
      variant: "destructive",
    });
  };

  return {
    records,
    addRecord,
    deleteRecord,
  };
}
