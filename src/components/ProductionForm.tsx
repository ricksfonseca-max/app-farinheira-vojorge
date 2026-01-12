import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner"; // Já incluso no seu package.json

const formSchema = z.object({
  produto: z.string().min(1, "Campo obrigatório"),
  quantidade: z.number().min(1, "Quantidade mínima é 1"),
  data: z.string(),
});

export function ProductionForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const response = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        toast.success("Produção registrada com sucesso no MySQL!");
        form.reset();
      }
    } catch (error) {
      toast.error("Erro ao conectar com o servidor.");
    }
  }

  // Renderização do formulário aqui...
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Campos do formulário */}
      <button type="submit">Registrar Produção</button>
    </form>
  );
}
