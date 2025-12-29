import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, FileSpreadsheet } from "lucide-react";
import type { ProductionRecord } from "@/types/production";

interface ProductionTableProps {
  records: ProductionRecord[];
  onDelete: (id: string) => void;
}

export function ProductionTable({ records, onDelete }: ProductionTableProps) {
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  return (
    <Card className="animate-slide-up shadow-lg border-0">
      <CardHeader className="bg-muted/50">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Registros de Produção
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {records.length} registro(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="font-semibold text-foreground">Data</TableHead>
                <TableHead className="font-semibold text-foreground">Hora</TableHead>
                <TableHead className="font-semibold text-foreground">Forno</TableHead>
                <TableHead className="font-semibold text-foreground">% Umidade</TableHead>
                <TableHead className="font-semibold text-foreground">Tipo Farinha</TableHead>
                <TableHead className="font-semibold text-foreground">Peneira</TableHead>
                <TableHead className="font-semibold text-foreground">Responsável</TableHead>
                <TableHead className="font-semibold text-foreground w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado. Adicione o primeiro registro acima.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record, index) => (
                  <TableRow 
                    key={record.id} 
                    className="hover:bg-muted/30 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell className="font-medium">{formatDate(record.data)}</TableCell>
                    <TableCell>{record.hora}</TableCell>
                    <TableCell>{record.forno}</TableCell>
                    <TableCell className="font-medium text-primary">{record.umidade}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-secondary/20 text-secondary-foreground rounded-md text-sm">
                        {record.tipoFarinha}
                      </span>
                    </TableCell>
                    <TableCell>{record.peneira}</TableCell>
                    <TableCell className="text-muted-foreground">{record.responsavel}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(record.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
