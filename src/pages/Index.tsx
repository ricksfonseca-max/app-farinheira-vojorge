import { Header } from "@/components/Header";
import { ProductionForm } from "@/components/ProductionForm";
import { ProductionTable } from "@/components/ProductionTable";
import { AuthForm } from "@/components/AuthForm";
import { useProductionRecords } from "@/hooks/useProductionRecords";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { records, loading: recordsLoading, addRecord, deleteRecord } = useProductionRecords();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={signOut}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary/80"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </Header>
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <ProductionForm onSubmit={addRecord} />
        {recordsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ProductionTable records={records} onDelete={deleteRecord} />
        )}
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} Farinheira Vô Jorge LTDA - Sistema de Controle</p>
      </footer>
    </div>
  );
};

export default Index;
