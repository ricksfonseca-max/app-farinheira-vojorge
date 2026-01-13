import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Activity } from "lucide-react";

export function MoistureTrends({ records }: { records: any[] }) {
  const [selectedForno, setSelectedForno] = useState<string>("all");

  // Prepara os dados: Filtra por forno e inverte para ficar cronológico
  const chartData = useMemo(() => {
    // Cria uma cópia para não alterar o original e inverte a ordem (antigo -> novo)
    const sortedRecords = [...records].reverse();

    return sortedRecords
      .filter(r => selectedForno === "all" || r.forno.toString() === selectedForno)
      .map(r => ({
        // Formata data curta: 12/01 14:30
        label: `${new Date(r.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} ${r.hora}`,
        umidade: parseFloat(r.umidade),
        forno: `Forno ${r.forno}`
      }));
  }, [records, selectedForno]);

  // Descobre quais fornos existem nos registros
  const fornosDisponiveis = Array.from(new Set(records.map(r => r.forno.toString()))).sort();

  return (
    <Card className="border-t-4 border-t-green-600 shadow-xl bg-white animate-in fade-in duration-700">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-7">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-green-600" /> TENDÊNCIA DE UMIDADE
          </CardTitle>
          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Controle de Qualidade</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Visualizar:</span>
          <Select value={selectedForno} onValueChange={setSelectedForno}>
            <SelectTrigger className="w-full sm:w-[160px] rounded-xl border-slate-200">
              <SelectValue placeholder="Todos Fornos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Fornos</SelectItem>
              {fornosDisponiveis.map(f => (
                <SelectItem key={f} value={f}>Forno {f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-[350px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#94a3b8', fontWeight: 600}}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['dataMin - 1', 'dataMax + 1']} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#94a3b8'}}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#166534', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Line 
                  name="Umidade (%)"
                  type="monotone" 
                  dataKey="umidade" 
                  stroke="#16a34a" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              Sem dados suficientes para gerar gráfico.
            </div>
          )}
        </div>
        
        <div className="mt-6 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
          <Activity className="text-green-600 h-5 w-5 flex-shrink-0" />
          <p className="text-sm text-green-800 leading-tight">
            <span className="font-bold">Análise Técnica:</span> Monitore se a linha verde se mantém estável. Picos repentinos indicam variações críticas no processo de secagem.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
