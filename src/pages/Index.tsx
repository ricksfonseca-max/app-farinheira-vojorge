import { Header } from "@/components/Header";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { useProductionRecords } from "@/hooks/useProductionRecords";

const Index = () => {
  const { records, addRecord, deleteRecord } = useProductionRecords();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <ProductionForm onSubmit={addRecord} />
        <ProductionTable records={records} onDelete={deleteRecord} />
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} Farinheira Vô Jorge LTDA - Sistema de Controle</p>
      </footer>
    </div>
  );
};

export default Index;
