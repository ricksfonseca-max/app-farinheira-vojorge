import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { X, Activity } from "lucide-react";

export function MoistureTrends({ records }: { records: any[] }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  if (!records || records.length === 0) {
    return (
      <Card className="shadow-2xl border-t-4 border-t-emerald-500 bg-[#0f172a] border-slate-800">
        <div className="p-16 text-center text-slate-500 font-medium">Aguardando telemetria...</div>
      </Card>
    );
  }

  const filteredRecords = records.filter(record => {
    if (!dataInicio && !dataFim) return true;
    try {
      const recordDate = new Date(record.data_hora).toISOString().split('T')[0];
      if (dataInicio && recordDate < dataInicio) return false;
      if (dataFim && recordDate > dataFim) return false;
      return true;
    } catch (e) { return true; }
  });

  const chartData = [...filteredRecords].reverse().map(record => ({
    horaExibicao: format(new Date(record.data_hora), "dd/MM HH:mm"),
    Umidade: record.umidade, Pressão: record.pressao, Forno: record.forno, Operador: record.responsavel
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-md p-4 border border-slate-700 rounded-lg shadow-2xl z-50 text-slate-200">
          <p className="font-bold text-slate-300 border-b border-slate-700 pb-2 mb-2">⏱ {label}</p>
          <p className="text-cyan-400 font-bold">💧 Umidade: {payload[0].value}%</p>
          <p className="text-orange-400 font-bold">🔥 Pressão: {payload[1].value} Bar</p>
          <p className="text-slate-400 text-sm mt-2 pt-2 border-t border-slate-700">👨‍🔧 Op: {payload[0].payload.Operador}</p>
        </div>
      );
    } return null;
  };

  return (
    <Card className="shadow-2xl border-t-4 border-t-emerald-500 bg-[#0f172a] border-slate-800">
      <CardHeader className="border-b border-slate-800/50 pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
          <Activity className="h-6 w-6 text-emerald-500" /> Telemetria de Secagem
        </CardTitle>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto px-2">
            <span className="text-xs font-bold text-slate-400 uppercase">De:</span>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-10 w-full sm:w-[140px] text-sm bg-slate-900 text-slate-200 border-slate-700" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto px-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Até:</span>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-10 w-full sm:w-[140px] text-sm bg-slate-900 text-slate-200 border-slate-700" />
          </div>
          {(dataInicio || dataFim) && (
            <Button variant="ghost" onClick={() => {setDataInicio(""); setDataFim("");}} className="h-10 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30">
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {chartData.length === 0 ? (
          <div className="h-[450px] w-full flex flex-col items-center justify-center text-slate-500 font-medium"><p className="text-4xl mb-4">📭</p><p>Nenhum registro encontrado.</p></div>
        ) : (
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="horaExibicao" stroke="#64748b" fontSize={11} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val}%`} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val} Bar`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Line yAxisId="left" type="monotone" dataKey="Umidade" name="Umidade (%)" stroke="#22d3ee" strokeWidth={3} activeDot={{ r: 6, fill: '#22d3ee', stroke: '#0f172a' }} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="Pressão" name="Pressão (Bar)" stroke="#fb923c" strokeWidth={3} activeDot={{ r: 6, fill: '#fb923c', stroke: '#0f172a' }} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
