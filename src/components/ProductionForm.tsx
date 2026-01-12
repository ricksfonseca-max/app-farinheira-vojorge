import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner"; // Já no seu package.json

export default function ProductionForm() {
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data) => {
    console.log("Dados coletados:", data);
    
    // Aqui faremos a chamada para o banco sql-industria
    try {
      // Exemplo de envio para sua API interna
      // const response = await fetch('/api/save-production', { method: 'POST', body: JSON.stringify(data) });
      
      toast.success("Produção registrada na Indústria Vô Jorge!");
      reset();
    } catch (error) {
      toast.error("Erro ao salvar no banco de dados.");
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Registro de Produção - Farinheira</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Operador</label>
          <input {...register("operator")} className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Quantidade (kg)</label>
          <input type="number" {...register("quantity")} className="w-full border p-2 rounded" required />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Salvar no Sistema
        </button>
      </form>
    </div>
  );
}
