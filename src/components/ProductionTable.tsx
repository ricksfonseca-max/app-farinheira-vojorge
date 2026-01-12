import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Calendar, Clock, Thermometer, User, Layers, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductionRecord } from "@/types/production";

interface ProductionTableProps {
  records: ProductionRecord[];
  onDelete: (id: string) => void;
}

export function ProductionTable({ records, onDelete }: ProductionTableProps) {
  if (records.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
        <p className="text-slate-400 font-medium">Nenhum registro encontrado no MySQL.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-bold text-slate-700">
              <div className="flex items-center gap-2"><Calendar size={14} /> Data</div>
            </TableHead>
            <TableHead className="font-bold text-slate-700 text-center">
              <div className="flex items-center justify-center gap-2"><Clock size={14} /> Hora</div>
            </TableHead>
            <TableHead className="font-bold text-slate-700 text-center">
              <div className="flex items-center justify-center gap-2"><Tag size={14} /> Forno</div>
            </TableHead>
            <TableHead className="font-bold text-slate-700 text-center">
              <div className="flex items-center justify-center gap-2"><Thermometer size={14} /> Umidade</div>
            </TableHead>
            <TableHead className="font-bold text-slate-700">
              <div className="flex items-center gap-2"><Layers size={14} /> Tipo / Peneira</div>
            </TableHead>
            <TableHead className="font-bold text-slate-700">
              <div className="flex items-center gap-2"><User size={14} /> Responsável</div>
            </TableHead>
            <TableHead className="text-right font-bold text-slate-700">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="hover:bg-green-50/50 transition-colors">
              <TableCell className="font-medium text-slate-600">
                {new Date(record.data).toLocaleDateString('pt-BR')}
              </TableCell>
              
              <TableCell className="text-center text-slate-600 font-mono">
                {record.hora}
              </TableCell>

              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200">
                  Forno {record.forno}
                </span>
              </TableCell>

              <TableCell className="text-center font-bold text-slate-700">
                {record.umidade}%
              </TableCell>

              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">{record.tipoFarinha}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-tighter">
                    Peneira: {record.peneira}
                  </span>
                </div>
              </TableCell>

              <TableCell className="text-slate-600 italic">
                {record.responsavel}
              </TableCell>

              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm("Deseja realmente excluir este registro da Indústria Vô Jorge?")) {
                      onDelete(record.id);
                    }
                  }}
                  className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <Trash2 size={18} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
