import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Eye, Image as ImageIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProductionRecord } from "@/types/production";
import { format } from "date-fns"; // Se não tiver date-fns, usaremos JS nativo abaixo

interface ProductionTableProps {
  records: ProductionRecord[];
  onDelete: (id: number) => void;
}

export function ProductionTable({ records, onDelete }: ProductionTableProps) {
  // Estado para controlar qual imagem está aberta no Zoom
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Função para formatar data e hora bonitinho
  const formatDate = (dateString: string, timeString: string) => {
    try {
      const date = new Date(`${dateString}T${timeString}`);
      return date.toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
      });
    } catch (e) {
      return `${dateString} ${timeString}`;
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data / Hora</TableHead>
              <TableHead className="text-center">Umidade</TableHead>
              <TableHead>Forno</TableHead>
              <TableHead>Farinha</TableHead>
              <TableHead>Bica</TableHead>
              <TableHead className="text-center">Evidência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Nenhum registro encontrado hoje.
                </TableCell>
              </TableRow>
            ) : (
              records.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-slate-50 transition-colors">
                  {/* Data e Hora */}
                  <TableCell className="font-medium text-xs text-slate-500">
                    {formatDate(rec.data, rec.hora)}
                    <div className="text-[10px] text-slate-400 uppercase">{rec.responsavel}</div>
                  </TableCell>

                  {/* Umidade (Com cor de alerta) */}
                  <TableCell className="text-center">
                    <span className={`font-bold px-2 py-1 rounded ${
                      rec.umidade >= 13.5 ? "bg-red-100 text-red-700" :
                      rec.umidade <= 11.5 ? "bg-yellow-100 text-yellow-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {Number(rec.umidade).toFixed(1)}%
                    </span>
                  </TableCell>

                  {/* Forno */}
                  <TableCell className="text-xs">{rec.forno}</TableCell>

                  {/* Farinha (Nova Coluna) */}
                  <TableCell>
                    <Badge variant="outline" className="text-slate-600 border-slate-300 font-normal">
                      {rec.tipoFarinha}
                    </Badge>
                  </TableCell>

                  {/* Bica / Peneira (Nova Coluna) */}
                  <TableCell className="text-xs text-slate-600">
                    {rec.peneira}
                  </TableCell>

                  {/* Foto (Botão de Visualizar) */}
                  <TableCell className="text-center">
                    {rec.foto && rec.foto.length > 50 ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        onClick={() => setSelectedImage(rec.foto!)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </TableCell>

                  {/* Botão Excluir */}
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDelete(rec.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- MODAL DE ZOOM DA FOTO --- */}
      {/* Isso cria uma janela preta sobre a tela quando clica na foto */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative bg-white p-2 rounded-lg shadow-2xl max-w-3xl max-h-[90vh] flex flex-col">
            {/* Botão Fechar */}
            <Button 
              variant="destructive" 
              size="icon" 
              className="absolute -top-4 -right-4 rounded-full shadow-md z-10"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            
            {/* A Imagem Grande */}
            <div className="overflow-auto rounded-md">
              <img 
                src={selectedImage} 
                alt="Evidência" 
                className="w-full h-auto object-contain max-h-[80vh]" 
              />
            </div>
            
            <p className="text-center text-xs text-slate-400 mt-2 font-mono">
              Evidência visual do registro
            </p>
          </div>
          
          {/* Clicar fora também fecha */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setSelectedImage(null)}
          ></div>
        </div>
      )}
    </>
  );
}
