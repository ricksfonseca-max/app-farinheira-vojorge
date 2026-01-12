import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

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

    if (!isLogin && name.trim().length < 2) {
      toast({
        title: "Nome inválido",
        description: "Por favor, insira seu nome completo.",
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
            description: error.message === "Invalid login credentials" 
              ? "Email ou senha incorretos" 
              : error.message,
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
        } else {
          toast({
            title: "Cadastro realizado!",
            description: "Bem-vindo ao sistema!",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground text-2xl font-bold">VJ</span>
          </div>
          <CardTitle className="text-2xl text-primary">Farinheira Vô Jorge</CardTitle>
          <CardDescription>
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  maxLength={100}
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
                maxLength={255}
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
                minLength={6}
              />
            </div>

            {!isLogin && (
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox 
                  id="lgpd"
                  checked={lgpdConsent}
                  onCheckedChange={(checked) => setLgpdConsent(checked === true)}
                />
                <Label htmlFor="lgpd" className="text-sm text-muted-foreground leading-relaxed">
                  Li e concordo com os{" "}
                  <button 
                    type="button"
                    className="text-primary underline hover:text-primary/80"
                    onClick={() => alert("Termos de Uso:\n\n1. Os dados coletados serão utilizados apenas para o funcionamento do sistema de controle de produção.\n\n2. Seus dados pessoais (nome e email) são armazenados de forma segura.\n\n3. Você pode solicitar a exclusão dos seus dados a qualquer momento.")}
                  >
                    Termos de Uso
                  </button>{" "}
                  e a{" "}
                  <button 
                    type="button"
                    className="text-primary underline hover:text-primary/80"
                    onClick={() => alert("Política de Privacidade (LGPD):\n\n• Dados coletados: nome, email e registros de produção.\n\n• Finalidade: Controle interno de produção da Farinheira Vô Jorge.\n\n• Armazenamento: Dados são armazenados de forma segura em servidores protegidos.\n\n• Seus direitos: Acesso, correção e exclusão dos dados pessoais.")}
                  >
                    Política de Privacidade
                  </button>
                </Label>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "Não tem conta? " : "Já tem conta? "}
            </span>
            <button
              type="button"
              className="text-primary underline hover:text-primary/80"
              onClick={() => {
                setIsLogin(!isLogin);
                setLgpdConsent(false);
              }}
            >
              {isLogin ? "Cadastre-se" : "Entrar"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
