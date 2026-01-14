import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Factory } from "lucide-react";

export function AuthForm() {
  const { signIn, signUp, loading } = useAuth();
  
  // Estado para controlar se é Login ou Cadastro
  const [isRegister, setIsRegister] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegister) {
      // Tentar Cadastrar
      const sucesso = await signUp(formData.nome, formData.email, formData.senha);
      if (sucesso) setIsRegister(false); // Se deu certo, volta para tela de login
    } else {
      // Tentar Logar
      await signIn(formData.email, formData.senha);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <div className="mb-8 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="bg-green-700 p-4 rounded-2xl shadow-lg mb-4">
          <Factory className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
          Indústria Vô Jorge
        </h1>
        <p className="text-sm font-bold text-green-600 tracking-widest uppercase">
          Controle de Qualidade
        </p>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-slate-800">
            {isRegister ? "Criar Conta" : "Acessar Sistema"}
          </CardTitle>
          <CardDescription>
            {isRegister 
              ? "Preencha seus dados para solicitar acesso" 
              : "Entre com seu e-mail e senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo Nome (Só aparece no Cadastro) */}
            {isRegister && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  placeholder="Seu nome"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="exemplo@farinheira.com.br"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                value={formData.senha}
                onChange={(e) => setFormData({...formData, senha: e.target.value})}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-green-700 hover:bg-green-800 font-bold"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? "CADASTRAR" : "ENTRAR"}
            </Button>
          </form>

          {/* Botão para trocar entre Login/Cadastro */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-slate-500 hover:text-green-700 underline underline-offset-4 transition-colors"
            >
              {isRegister 
                ? "Já tem uma conta? Faça Login" 
                : "Não tem acesso? Cadastre-se"}
            </button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
