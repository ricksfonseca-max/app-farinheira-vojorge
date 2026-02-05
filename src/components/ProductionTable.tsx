import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image as ImageIcon, ZoomIn, Gauge } from "lucide-react";

interface Record {
  id?: number;
  data_hora?: string;
  umidade: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  responsavel: string;
  foto?: string;
  pressao_caldeira?: number; // Novo campo da caldeira
}

interface ProductionTableProps {
  records: Record[];
}

export function ProductionTable({ records }: ProductionTableProps) {
  // Estado para controlar qual imagem está aberta no modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Função auxiliar para garantir que o Base64 tenha o prefixo correto
  const getRenderableImageSrc = (fotoData: string) => {
    if (!fotoData) return "";
    if (fotoData.startsWith("data:image")) return fotoData;
    return `data:image/jpeg;base64,${fotoData}`;
  };

  // Formata data ou mostra "Agora" se for recente
  const formatDate = (dateString?: string) => {
    if (!dateString) return <span className="text-green-600 font-bold animate-pulse">Agora</span>;
    try {
      return new Date(dateString).toLocaleString("pt-BR", {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50 text-xs uppercase tracking-wider font-medium text-slate-500">
              <TableHead className="w-[140px]">Data/Hora</TableHead>
              <TableHead className="text-center">Umidade</TableHead>
              <TableHead className="text-center">Pressão</TableHead> {/* Nova Coluna */}
              <TableHead>Forno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Peneira</TableHead>
              <TableHead className="text-right pr-4">Evidência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                  Nenhum registro encontrado hoje.
                </TableCell>
              </TableRow>
            ) : (
              records.map((record, index) => {
                const imgSrc = record.foto ? getRenderableImageSrc(record.foto) : null;
                
                return (
                <TableRow key={record.id || index} className="hover:bg-slate-50/80 transition-colors font-medium text-sm text-slate-700">
                  <TableCell className="whitespace-nowrap">
                    {formatDate(record.data_hora)}
                  </TableCell>
                  
                  {/* UMIDADE */}
                  <TableCell className="text-center">
                    <Badge 
                      variant={record.umidade > 14 || record.umidade < 10 ? "destructive" : "outline"}
                      className={`font-bold ${
                          record.umidade >= 10 && record.umidade <= 14 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : ""
                      }`}
                    >
                      {record.umidade.toFixed(1)}%
                    </Badge>
                  </TableCell>

                  {/* PRESSÃO CALDEIRA (IoT) */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 font-mono text-xs">
                        <Gauge className="w-3 h-3 text-slate-400" />
                        {record.pressao_caldeira ? record.pressao_caldeira + " Bar" : "-"}
                    </div>
                  </TableCell>
                  
                  <TableCell>{record.forno}</TableCell>
                  <TableCell>{record.tipo_farinha}</TableCell>
                  <TableCell>{record.peneira}</TableCell>
                  
                  {/* FOTO COM ZOOM */}
                  <TableCell className="text-right pr-4">
                    {imgSrc ? (
                      <div 
                        className="relative group w-12 h-12 ml-auto overflow-hidden rounded-lg border-2 border-slate-200 cursor-zoom-in bg-slate-100 hover:border-green-400 transition-all shadow-sm hover:shadow-md"
                        onClick={() => setSelectedImage(imgSrc)}
                        role="button"
                        aria-label="Ver evidência ampliada"
                      >
                         <img 
                           src={imgSrc} 
                           alt="Amostra" 
                           className="w-full h-full object-cover transition-transform group-hover:scale-110"
                         />
                         <div className="absolute inset-0 bg-black/0 transition-all group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                           <ZoomIn className="text-white w-5 h-5 drop-shadow-sm" />
                         </div>
                      </div>
                    ) : (
                      <span className="text-slate-300 flex justify-end"><ImageIcon className="w-5 h-5"/></span>
                    )}
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </div>

      {/* MODAL DE VISUALIZAÇÃO */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center outline-none">
            <div className="relative flex items-center justify-center p-4 w-full h-full" onClick={() => setSelectedImage(null)}>
              {selectedImage && (
                <img 
                  src={selectedImage} 
                  alt="Evidência Ampliada" 
                  className="w-auto h-auto max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300 bg-white"
                  onClick={(e) => e.stopPropagation()} 
                />
              )}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
