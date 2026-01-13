import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import type { ProductionRecord } from "@/types/production";

interface ProductionTableProps {
  records: ProductionRecord[];
  onDelete: (id: string) => void;
}

export function ProductionTable({ records, onDelete }: ProductionTableProps) {
  
  // Função auxiliar para formatar a data sem fuso horário
  const formatarData = (dataString: string) => {
    if (!dataString) return "-";
    // Pega "2025-01-14", divide em pedaços, inverte e junta com barra
    // Resultado: "14/01/2025" (Blindado contra Timezone)
    return dataString.toString().split('T')[0].split('-').reverse().join('/');
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-bold text-slate-700">Data</TableHead>
            <TableHead className="font-bold text-slate-700">Hora</TableHead>
            <TableHead className="font-bold text-slate-700">Forno</TableHead>
            <TableHead className="font-bold text-slate-700">Umidade</TableHead>
            <TableHead className="font-bold text-slate-700 hidden sm:table-cell">Tipo</TableHead>
            <TableHead className="font-bold text-slate-700 hidden md:table-cell">Resp.</TableHead>
            <TableHead className="text-right font-bold text-slate-700">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-32 text-slate-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-8 w-8 opacity-20" />
                  <p>Nenhum registro encontrado hoje.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id} className="hover:bg-slate-50 transition-colors">
                
                {/* ✅ AQUI ESTÁ A CORREÇÃO DA DATA */}
                <TableCell className="font-medium text-slate-700">
                  {formatarData(record.data)}
                </TableCell>

                <TableCell className="text-slate-600">
                  {record.hora.slice(0, 5)}
                </TableCell>
                
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                    Forno {record.forno}
                  </span>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${
                      record.umidade > 13 || record.umidade < 10 
                        ? "text-red-600" 
                        : "text-green-600"
                    }`}>
                      {record.umidade}%
                    </span>
                  </div>
                </TableCell>
                
                <TableCell className="hidden sm:table-cell text-slate-500 text-sm">
                  {record.tipoFarinha}
                </TableCell>
                
                <TableCell className="hidden md:table-cell text-slate-500 text-sm capitalize">
                  {record.responsavel}
                </TableCell>
                
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(record.id)}
                    className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                    title="Excluir registro"
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
