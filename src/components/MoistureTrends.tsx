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
    // 1. Cria uma cópia segura dos dados
    let filteredData = [...records];

    // 2. Filtra por Forno
    if (selectedForno !== "all") {
      filteredData = filteredData.filter(r => r.forno.toString() === selectedForno);
    }

    // 3. Filtra por Data Inicial
    if (dateStart) {
      filteredData = filteredData.filter(r => r.data >= dateStart);
    }

    // 4. Filtra por Data Final
    if (dateEnd) {
      filteredData = filteredData.filter(r => r.data <= dateEnd);
    }

    // 5. Ordena Cronologicamente (Antigo -> Novo) para o gráfico desenhar da esquerda para a direita
    filteredData.sort((a, b) => {
      const dateA = new Date(`${a.data}T${a.hora}`);
      const dateB = new Date(`${b.data}T${b.hora}`);
      return dateA.getTime() - dateB.getTime();
    });

    // 6. Formata para o Recharts
    return filteredData.map(r => ({
      // Rótulo do eixo X: Data (dia/mês) + Hora
      label: `${new Date(r.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} ${r.hora.slice(0, 5)}`,
      fullDate: `${new Date(r.data).toLocaleDateString('pt-BR')} às ${r.hora}`,
      umidade: parseFloat(r.umidade),
      forno: `Forno ${r.forno}`,
      responsavel: r.responsavel
    }));
  }, [records, selectedForno, dateStart, dateEnd]);

  // Lista de fornos disponíveis para o filtro
  const fornosDisponiveis = Array.from(new Set(records.map(r => r.forno.toString()))).sort();

  // Função para limpar filtros
  const clearFilters = () => {
    setSelectedForno("all");
    setDateStart("");
    setDateEnd("");
  };

  return (
    <Card className="border-t-4 border-t-green-600 shadow-xl bg-white animate-in fade-in duration-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Título */}
          <div className="space-y-1">
            <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-green-600" /> TENDÊNCIA DE UMIDADE
            </CardTitle>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">
              Controle de Qualidade ({chartData.length} registros)
            </p>
          </div>

          {/* Área de Filtros */}
          <div className="flex flex-wrap items-end gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            
            {/* Filtro Forno */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Forno</span>
              <Select value={selectedForno} onValueChange={setSelectedForno}>
                <SelectTrigger className="w-[110px] h-9 text-xs font-bold bg-white border-slate-200">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {fornosDisponiveis.map(f => (
                    <SelectItem key={f} value={f}>Forno {f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro Data Início */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">De</span>
              <Input 
                type="date" 
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-[130px] h-9 text-xs bg-white border-slate-200"
              />
            </div>

            {/* Filtro Data Fim */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">Até</span>
              <Input 
                type="date" 
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-[130px] h-9 text-xs bg-white border-slate-200"
              />
            </div>

            {/* Botão Limpar (só aparece se tiver filtro ativo) */}
            {(selectedForno !== "all" || dateStart || dateEnd) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={clearFilters}
                className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50"
                title="Limpar Filtros"
              >
                <X size={16} />
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
                  domain={['auto', 'auto']} // Ajusta escala automática
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
                  // Customizando o tooltip para mostrar mais detalhes
                  formatter={(value: any, name: any, props: any) => [
                    <span className="text-green-700 font-bold text-lg">{value}%</span>, 
                    <span className="text-slate-600 font-medium">{props.payload.forno}</span>
                  ]}
                  labelFormatter={(label) => label} // Usa o label formatado
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
              <p>Nenhum dado encontrado para este período/forno.</p>
              <Button variant="link" onClick={clearFilters} className="text-green-600 font-bold">
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
        
        <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-start gap-3">
          <Activity className="text-green-600 h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-bold text-green-800">Análise de Tendência</p>
            <p className="leading-relaxed mt-1">
              Use os filtros acima para isolar um forno específico e verificar a estabilidade da secagem ao longo dos dias. Linhas constantes indicam processo sob controle.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
