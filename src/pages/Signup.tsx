import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { translateAuthError } from "@/lib/auth-errors";
import { PasswordStrength } from "@/components/PasswordStrength";
import { Separator } from "@/components/ui/separator";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

type Fields = { fullName?: string; email?: string; password?: string };

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Fields>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validators: Record<string, (v: string) => string | undefined> = {
    fullName: (v) => {
      if (!v.trim()) return "Informe seu nome completo";
      if (v.trim().length < 3) return "O nome deve ter no mínimo 3 caracteres";
      return undefined;
    },
    email: (v) => {
      if (!v.trim()) return "Informe seu e-mail";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Formato de e-mail inválido";
      return undefined;
    },
    password: (v) => {
      if (!v) return "Informe uma senha";
      if (v.length < 6) return "A senha deve ter no mínimo 6 caracteres";
      return undefined;
    },
  };

  const values: Record<string, string> = { fullName, email, password };
  const setters: Record<string, (v: string) => void> = {
    fullName: setFullName,
    email: setEmail,
    password: setPassword,
  };

  const handleChange = (field: string, value: string) => {
    setters[field](value);
    if (touched[field]) setErrors(prev => ({ ...prev, [field]: validators[field](value) }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validators[field](values[field]) }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Fields = {
      fullName: validators.fullName(fullName),
      email: validators.email(email),
      password: validators.password(password),
    };
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true });
    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    }
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error("Erro ao cadastrar com Google. Tente novamente.");
        setGoogleLoading(false);
        return;
      }

      if (result.redirected) {
        return;
      }
    } catch {
      toast.error("Erro ao cadastrar com Google. Tente novamente.");
      setGoogleLoading(false);
    }
  };

  const fieldClass = (field: string) =>
    (errors as Record<string, string | undefined>)[field] ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Criar conta</CardTitle>
          <CardDescription>Preencha os dados para se cadastrar</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup} noValidate>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignup}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Cadastrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                onBlur={() => handleBlur("fullName")}
                className={fieldClass("fullName")}
                autoComplete="name"
              />
              <FieldError message={errors.fullName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={fieldClass("email")}
                autoComplete="email"
              />
              <FieldError message={errors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                className={fieldClass("password")}
                autoComplete="new-password"
              />
              <FieldError message={errors.password} />
              <PasswordStrength password={password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar conta
            </Button>
            <Link to="/login" className="text-sm text-primary hover:underline">Já tem uma conta? Entrar</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
