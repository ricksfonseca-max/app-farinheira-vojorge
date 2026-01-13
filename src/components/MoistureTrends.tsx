import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, Activity, Filter, X } from "lucide-react";

export function MoistureTrends({ records }: { records: any[] }) {
  const [selectedForno, setSelectedForno] = useState<string>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // Processamento dos dados
  const chartData = useMemo(() => {
    let filteredData = [...records];

    // Filtro por Forno
    if (selectedForno !== "all") {
      filteredData = filteredData.filter(r => r.forno.toString() === selectedForno);
    }

    // Filtro por Data Inicial
    if (dateStart) {
      filteredData = filteredData.filter(r => r.data >= dateStart);
    }

    // Filtro por Data Final
    if (dateEnd) {
      filteredData = filteredData.filter(r => r.data <= dateEnd);
    }

    // Ordenação Cronológica
    filteredData.sort((a, b) => {
      const dateA = new Date(`${a.data}T${a.hora}`);
      const dateB = new Date(`${b.data}T${b.hora}`);
      return dateA.getTime() - dateB.getTime();
    });

return filteredData.map(r => {
      // CORREÇÃO: Quebra a string "2025-01-14" manualmente para não sofrer com fuso horário
      // Pega apenas a parte da data (caso venha com tempo junto)
      const dataLimpa = r.data.toString().split('T')[0]; 
      const [ano, mes, dia] = dataLimpa.split('-');
      
      return {
        // Label do Eixo X: Dia/Mês + Hora
        label: `${dia}/${mes} ${r.hora.slice(0, 5)}`,
        
        // Tooltip: Data Completa
        fullDate: `${dia}/${mes}/${ano} às ${r.hora}`,
        
        umidade: parseFloat(r.umidade),
        forno: `Forno ${r.forno}`,
        responsavel: r.responsavel
      };
    });
  }, [records, selectedForno, dateStart, dateEnd]);

  // Lógica para listar os fornos:
  // Pega os fornos existentes nos registros OU usa 1, 2, 3 como padrão se não tiver nada ainda
  const fornosDisponiveis = useMemo(() => {
    const fornosReais = Array.from(new Set(records.map(r => r.forno.toString()))).sort();
    // Se não tiver registro nenhum, mostra pelo menos 1, 2 e 3 para não ficar vazio
    if (fornosReais.length === 0) return ["1", "2", "3"];
    return fornosReais;
  }, [records]);

  const clearFilters = () => {
    setSelectedForno("all");
    setDateStart("");
    setDateEnd("");
  };

  return (
    <Card className="border-t-4 border-t-green-600 shadow-xl bg-white animate-in fade-in duration-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          
          {/* Título */}
          <div className="space-y-1">
            <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-green-600" /> TENDÊNCIA DE UMIDADE
            </CardTitle>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">
              Controle de Qualidade ({chartData.length} registros)
            </p>
          </div>

          {/* Área de Filtros - Agora com inputs maiores */}
          <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 w-full xl:w-auto">
            
            {/* Filtro Forno - Aumentei a largura */}
            <div className="space-y-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Forno</span>
              <Select value={selectedForno} onValueChange={setSelectedForno}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 text-sm font-bold bg-white border-slate-200">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Fornos</SelectItem>
                  {fornosDisponiveis.map(f => (
                    <SelectItem key={f} value={f}>Forno {f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro Data Início - Aumentei para w-[160px] */}
            <div className="space-y-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Data Inicial</span>
              <Input 
                type="date" 
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full sm:w-[160px] h-10 text-sm bg-white border-slate-200 cursor-pointer"
              />
            </div>

            {/* Filtro Data Fim - Aumentei para w-[160px] */}
            <div className="space-y-1 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Data Final</span>
              <Input 
                type="date" 
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full sm:w-[160px] h-10 text-sm bg-white border-slate-200 cursor-pointer"
              />
            </div>

            {/* Botão Limpar */}
            {(selectedForno !== "all" || dateStart || dateEnd) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={clearFilters}
                className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 mb-[1px]"
                title="Limpar Filtros"
              >
                <X size={20} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-[400px] w-full mt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#94a3b8', fontWeight: 600}}
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{fill: '#94a3b8'}}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}
                  cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '5 5' }}
                  formatter={(value: any, name: any, props: any) => [
                    <span className="text-green-700 font-bold text-lg">{value}%</span>, 
                    <span className="text-slate-600 font-medium">{props.payload.forno}</span>
                  ]}
                  labelFormatter={(label) => label} 
                />
                <Legend verticalAlign="top" height={36}/>
                <Line 
                  name="Umidade (%)"
                  type="monotone" 
                  dataKey="umidade" 
                  stroke="#16a34a" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#15803d" }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
              <Filter className="h-10 w-10 mb-2 opacity-20" />
              <p>Nenhum dado encontrado com estes filtros.</p>
              <Button variant="link" onClick={clearFilters} className="text-green-600 font-bold">
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
        
        <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-start gap-3">
          <Activity className="text-green-600 h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-bold text-green-800">Dica de Operação:</p>
            <p className="leading-relaxed mt-1">
              Use as datas para isolar um período específico (ex: turno de ontem). O gráfico mostra apenas os fornos que tiveram produção registrada nessas datas.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
