import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { X } from "lucide-react";

export function MoistureTrends({ records }: { records: any[] }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  if (!records || records.length === 0) {
    return (
      <Card className="shadow-lg border-t-4 border-t-blue-600 bg-white">
        <div className="p-16 text-center text-slate-500 font-medium">
          Nenhum dado registrado para gerar os gráficos.
        </div>
      </Card>
    );
  }

  // Filtra os registros pelo intervalo de datas selecionado
  const filteredRecords = records.filter(record => {
    if (!dataInicio && !dataFim) return true; // Se não tem filtro, mostra tudo
    
    try {
      const recordDate = new Date(record.data_hora).toISOString().split('T')[0];
      if (dataInicio && recordDate < dataInicio) return false;
      if (dataFim && recordDate > dataFim) return false;
      return true;
    } catch (e) {
      return true;
    }
  });

  // Prepara os dados pro gráfico
  const chartData = [...filteredRecords].reverse().map(record => ({
    horaExibicao: format(new Date(record.data_hora), "dd/MM HH:mm"),
    Umidade: record.umidade,
    Pressão: record.pressao,
    Forno: record.forno,
    Operador: record.responsavel
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-xl z-50">
          <p className="font-bold text-slate-700 border-b pb-2 mb-2">⏰ {label}</p>
          <p className="text-blue-600 font-bold">💧 Umidade: {payload[0].value}%</p>
          <p className="text-orange-600 font-bold">🔥 Pressão: {payload[1].value} Bar</p>
          <p className="text-slate-500 text-sm mt-2 pt-2 border-t">👨‍🔧 {payload[0].payload.Operador}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-lg border-t-4 border-t-blue-600 bg-white">
      <CardHeader className="border-b border-slate-100 pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
          📈 Secagem vs Pressão
        </CardTitle>
        
        {/* FILTRO DE DATA MAIS LARGO E ALTO PARA CELULAR */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm font-bold text-slate-500 uppercase w-8">De:</span>
            <Input 
              type="date" 
              value={dataInicio} 
              onChange={(e) => setDataInicio(e.target.value)} 
              className="h-12 w-full sm:w-[160px] text-sm bg-white focus-visible:ring-blue-500 border-slate-300 font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm font-bold text-slate-500 uppercase w-8">Até:</span>
            <Input 
              type="date" 
              value={dataFim} 
              onChange={(e) => setDataFim(e.target.value)} 
              className="h-12 w-full sm:w-[160px] text-sm bg-white focus-visible:ring-blue-500 border-slate-300 font-medium"
            />
          </div>

          {(dataInicio || dataFim) && (
            <Button 
              variant="outline" 
              onClick={() => {setDataInicio(""); setDataFim("");}} 
              className="h-12 w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-bold flex gap-2"
            >
              <X className="w-5 h-5" /> Limpar
            </Button>
          )}
          
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {chartData.length === 0 ? (
          <div className="h-[450px] w-full flex flex-col items-center justify-center text-slate-500 font-medium">
            <p className="text-4xl mb-4">📭</p>
            <p>Nenhum registro encontrado neste período.</p>
          </div>
        ) : (
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="horaExibicao" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#3b82f6" fontSize={12} tickFormatter={(val) => `${val}%`} />
                <YAxis yAxisId="right" orientation="right" stroke="#f97316" fontSize={12} tickFormatter={(val) => `${val} Bar`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Line yAxisId="left" type="monotone" dataKey="Umidade" name="Umidade (%)" stroke="#3b82f6" strokeWidth={4} activeDot={{ r: 8 }} animationDuration={1500} />
                <Line yAxisId="right" type="monotone" dataKey="Pressão" name="Pressão (Bar)" stroke="#f97316" strokeWidth={4} activeDot={{ r: 8 }} animationDuration={1500} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
