import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, X } from "lucide-react";

interface Record { id: number; data_hora: string; responsavel: string; umidade: number; pressao: number; forno: string; tipo_farinha: string; peneira: string; foto?: string; }
interface ProductionTableProps { records: Record[]; }

export function ProductionTable({ records }: ProductionTableProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <div className="bg-[#0f172a] text-slate-200 w-full flex flex-col h-full rounded-b-xl">
      
      {/* CABEÇALHO INTERNO DA TABELA (Adeus fundo branco e texto azul!) */}
      <div className="flex items-center gap-2 p-4 bg-slate-900/80 border-b border-slate-800">
        <History className="h-5 w-5 text-emerald-500" />
        <h4 className="font-semibold text-slate-200">Últimos Registros</h4>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* LINHA DE TÍTULOS (Escurecida) */}
            <TableRow className="bg-slate-950 border-slate-800 hover:bg-slate-950">
              <TableHead className="font-bold text-slate-400">Data/Hora</TableHead>
              <TableHead className="font-bold text-slate-400">Responsável</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Umidade</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Pressão</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Evidência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                <TableCell className="text-sm whitespace-nowrap text-slate-300">
                  {new Date(record.data_hora).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="font-medium text-sm whitespace-nowrap text-slate-200">{record.responsavel}</TableCell>
                <TableCell className="text-center font-bold text-cyan-400 text-sm bg-cyan-950/10">{Number(record.umidade).toFixed(1)}%</TableCell>
                <TableCell className="text-center font-bold text-orange-400 text-sm bg-orange-950/10">{Number(record.pressao).toFixed(1)} Bar</TableCell>
                <TableCell className="text-center">
                  {record.foto ? (
                    <div className="flex justify-center">
                      <img src={record.foto} className="h-10 w-10 object-cover rounded border border-slate-600 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" alt="Amostra" onClick={() => setZoomedImage(record.foto || null)} />
                    </div>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MODAL ZOOM ESCURO DA FOTO */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-2" onClick={() => setZoomedImage(null)}>
            <X className="w-8 h-8" />
          </button>
          <img src={zoomedImage} alt="Foto Ampliada" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border border-white/10 animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
