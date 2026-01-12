import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Factory } from "lucide-react"; // Adicionado ícone de Fábrica

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !lgpdConsent) {
      toast({
        title: "Consentimento necessário",
        description: "Você precisa aceitar os termos de uso e política de privacidade.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Erro no login",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        const { error } = await signUp(email, password, name.trim());
        if (error) {
          toast({
            title: "Erro no cadastro",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md border-t-8 border-t-green-600 shadow-2xl">
        <CardHeader className="text-center">
          {/* Círculo com ícone de Fábrica em vez de apenas letras */}
          <div className="mx-auto mb-4 w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200">
            <Factory className="text-white w-10 h-10" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Vô Jorge</CardTitle>
          <CardDescription className="font-medium text-slate-500">
            {isLogin ? "Acesso ao Sistema de Produção" : "Crie sua conta de operador"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="rounded-xl border-slate-200"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl border-slate-200"
              />
            </div>

            {!isLogin && (
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox 
                  id="lgpd"
                  checked={lgpdConsent}
                  onCheckedChange={(checked) => setLgpdConsent(checked === true)}
                />
                <Label htmlFor="lgpd" className="text-xs text-muted-foreground leading-relaxed">
                  Li e concordo com a Política de Privacidade (LGPD) da fábrica.
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-green-100" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isLogin ? "ENTRAR" : "CADASTRAR"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              type="button"
              className="text-green-600 font-bold hover:underline"
              onClick={() => {
                setIsLogin(!isLogin);
                setLgpdConsent(false);
              }}
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre aqui"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
