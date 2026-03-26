import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, X } from "lucide-react";

interface Record {
  id: number;
  data_hora: string;
  responsavel: string;
  umidade: number;
  pressao: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  foto?: string;
}

interface ProductionTableProps {
  records: Record[];
}

export function ProductionTable({ records }: ProductionTableProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
            <History className="h-5 w-5 text-blue-600" /> Últimos Registros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead className="font-bold">Data/Hora</TableHead>
                  <TableHead className="font-bold">Responsável</TableHead>
                  <TableHead className="font-bold text-center">Umidade</TableHead>
                  <TableHead className="font-bold text-center">Pressão</TableHead>
                  <TableHead className="font-bold text-center">Evidência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(record.data_hora).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{record.responsavel}</TableCell>
                    <TableCell className="text-center font-bold text-blue-600 text-sm">{Number(record.umidade).toFixed(1)}%</TableCell>
                    <TableCell className="text-center font-bold text-orange-600 text-sm">{Number(record.pressao).toFixed(1)} Bar</TableCell>
                    <TableCell className="text-center">
                      {record.foto ? (
                        <div className="flex justify-center">
                          <img 
                            src={record.foto} 
                            className="h-10 w-10 object-cover rounded border shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                            alt="Amostra" 
                            onClick={() => setZoomedImage(record.foto || null)} 
                          />
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* TELA ESCURA DE ZOOM (MODAL) */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/50 rounded-full p-2"
            onClick={() => setZoomedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={zoomedImage} 
            alt="Foto Ampliada" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border border-white/10 animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
}
