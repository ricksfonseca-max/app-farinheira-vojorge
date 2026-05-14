import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, X, User, Building2, Package } from "lucide-react";
import { ProductionRecord } from "@/types/production";

interface ProductionTableProps { records: ProductionRecord[]; }

export function ProductionTable({ records }: ProductionTableProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <div className="bg-[#0f172a] text-slate-200 w-full flex flex-col h-full rounded-b-xl border border-slate-800">
      <div className="flex items-center gap-2 p-4 bg-slate-900/80 border-b border-slate-800">
        <History className="h-5 w-5 text-emerald-500" />
        <h4 className="font-semibold text-slate-200">Últimos Registros</h4>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-950 border-slate-800 hover:bg-slate-950">
              <TableHead className="font-bold text-slate-400 w-[50px]">Turno</TableHead>
              <TableHead className="font-bold text-slate-400">Data/Hora</TableHead>
              <TableHead className="font-bold text-slate-400"><div className="flex items-center gap-1"><Building2 className="w-3 h-3"/> Cliente</div></TableHead>
              <TableHead className="font-bold text-slate-400"><div className="flex items-center gap-1"><Package className="w-3 h-3"/> Produto</div></TableHead>
              <TableHead className="font-bold text-slate-400"><div className="flex items-center gap-1"><User className="w-3 h-3"/> Operador</div></TableHead>
              <TableHead className="font-bold text-center text-slate-400">Umidade</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Pressão</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Foto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                <TableCell className="text-center font-bold text-indigo-400">T{record.turno_num || "-"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap text-slate-400">
                  {new Date(record.data_hora).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-200">{record.cliente || "-"}</TableCell>
                <TableCell className="text-sm text-slate-300">{record.produto || "-"}</TableCell>
                <TableCell className="text-sm text-slate-300">{record.responsavel}</TableCell>
                <TableCell className="text-center font-bold text-cyan-400 bg-cyan-950/10">{Number(record.umidade).toFixed(1)}%</TableCell>
                <TableCell className="text-center font-bold text-orange-400 bg-orange-950/10">{Number(record.pressao).toFixed(1)}</TableCell>
                <TableCell className="text-center">
                  {record.foto ? (
                    <img src={record.foto} className="h-8 w-8 object-cover rounded border border-slate-600 cursor-pointer mx-auto" alt="Amostra" onClick={() => setZoomedImage(record.foto || null)} />
                  ) : <span className="text-slate-700">-</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {zoomedImage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-8 h-8" /></button>
          <img src={zoomedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
