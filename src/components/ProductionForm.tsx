import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ClipboardList, Save, Package } from "lucide-react";

export function ProductionForm() {
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data: any) => {
    // Log para verificar os dados antes de enviar ao MySQL (sql-industria)
    console.log("Dados da Produção Vô Jorge:", data);
    
    // Simulação de salvamento
    toast.success("Registro enviado para o sistema da fábrica!");
    reset();
  };

  return (
    <div className="max-w-lg mx-auto p-8 bg-white rounded-2xl shadow-xl border border-blue-100 mt-8">
      <div className="flex items-center gap-3 mb-8 border-b pb-4">
        <div className="p-2 bg-blue-600 rounded-lg text-white">
          <ClipboardList size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Indústria Vô Jorge</h2>
          <p className="text-sm text-slate-500">Registro de Produção - Farinheira</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Campo Operador */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Operador Responsável</label>
            <input 
              {...register("operador")} 
              placeholder="Digite seu nome"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" 
              required 
            />
          </div>

          {/* Campo Produto */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Produto</label>
            <select 
              {...register("produto")}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            >
              <option value="farinha-mandioca">Farinha de Mandioca</option>
              <option value="polvilho-doce">Polvilho Doce</option>
              <option value="polvilho-azedo">Polvilho Azedo</option>
            </select>
          </div>

          {/* Campo Quantidade */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Quantidade (Sacos)</label>
            <div className="relative">
              <input 
                type="number" 
                {...register("quantidade")} 
                placeholder="0"
                className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                required 
              />
              <Package className="absolute left-3 top-3.5 text-slate-400" size={18} />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Save size={22} />
          Salvar no MySQL
        </button>
      </form>
    </div>
  );
}
