import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, X, User, Building2, Package } from "lucide-react";

interface Record { 
  id?: number; 
  data_hora?: string; 
  responsavel: string; 
  umidade: number; 
  pressao: number; 
  forno: string; 
  tipo_farinha: string; 
  peneira: string; 
  foto?: string;
  turno_num?: any; // Alterado para any para tratar T1, T2 ou números
  cliente?: string;
  produto?: string;
  ensaque?: string;
}

interface ProductionTableProps { records: Record[]; }

export function ProductionTable({ records }: ProductionTableProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // --- LÓGICA DE TRADUÇÃO RIGOROSA ---
  const getLetraTurno = (val: any) => {
    // Converte para string e limpa espaços/letras (ex: de "T2" sobra "2")
    const numStr = String(val || "").replace(/\D/g, "");
    const num = parseInt(numStr);

    if (num === 1) return "A";
    if (num === 2) return "B";
    if (num === 3) return "C";
    return "-";
  };

  return (
    <div className="bg-[#0f172a] text-slate-200 w-full flex flex-col h-full rounded-b-xl border-t-0 border border-slate-800">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-950 border-slate-800 hover:bg-slate-950">
              <TableHead className="font-bold text-slate-400 w-[80px] text-center">Turno</TableHead>
              <TableHead className="font-bold text-slate-400">Data/Hora</TableHead>
              <TableHead className="font-bold text-slate-400"><div className="flex items-center gap-1"><Building2 size={14}/> Cliente</div></TableHead>
              <TableHead className="font-bold text-slate-400"><div className="flex items-center gap-1"><Package size={14}/> Produto</div></TableHead>
              <TableHead className="font-bold text-slate-400">Operador</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Umidade</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Pressão</TableHead>
              <TableHead className="font-bold text-center text-slate-400">Foto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record, i) => (
              <TableRow key={record.id || i} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                <TableCell className="text-center font-black text-xl text-indigo-400 bg-indigo-950/20">
                  {getLetraTurno(record.turno_num)}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap text-slate-400">
                  {record.data_hora ? new Date(record.data_hora).toLocaleString('pt-BR') : "-"}
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white"><X size={32} /></button>
          <img src={zoomedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
