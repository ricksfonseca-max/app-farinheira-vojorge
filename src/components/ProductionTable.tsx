import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
// import { ptBR } from "date-fns/locale"; // Opcional para português

interface Record {
  id?: number;
  data_hora?: string; // Pode vir do banco como string ISO
  umidade: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  responsavel: string;
  foto?: string;
}

interface ProductionTableProps {
  records: Record[];
  onDelete?: (id: number) => void;
}

export function ProductionTable({ records, onDelete }: ProductionTableProps) {
  
  // Função segura para formatar data
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Agora"; // Se não tiver data (ex: acabou de salvar), mostra "Agora"
    try {
      return new Date(dateString).toLocaleString("pt-BR");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-[180px]">Data / Hora</TableHead>
            <TableHead>Umidade</TableHead>
            <TableHead>Forno</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Peneira</TableHead>
            <TableHead className="text-right">Foto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record, index) => (
              <TableRow key={record.id || index} className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-slate-600">
                  {formatDate(record.data_hora)}
                </TableCell>
                
                <TableCell>
                  <Badge 
                    variant={record.umidade > 14 || record.umidade < 10 ? "destructive" : "secondary"}
                    className={
                        record.umidade >= 10 && record.umidade <= 14 
                        ? "bg-green-100 text-green-700 hover:bg-green-200" 
                        : ""
                    }
                  >
                    {record.umidade.toFixed(1)}%
                  </Badge>
                </TableCell>
                
                <TableCell>{record.forno}</TableCell>
                <TableCell>{record.tipo_farinha}</TableCell>
                <TableCell>{record.peneira}</TableCell>
                
                <TableCell className="text-right">
                  {record.foto ? (
                    <div className="flex justify-end gap-2">
                       {/* Miniatura da Foto (Base64) */}
                       <div className="relative group w-10 h-10 overflow-hidden rounded-md border border-slate-200 cursor-pointer hover:scale-150 transition-transform origin-right z-10 bg-white">
                          <img 
                            src={record.foto.startsWith('data:') ? record.foto : `data:image/jpeg;base64,${record.foto}`} 
                            alt="Amostra" 
                            className="w-full h-full object-cover"
                          />
                       </div>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs"><ImageIcon className="w-4 h-4 ml-auto"/></span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
