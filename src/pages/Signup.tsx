import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";

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
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                className={fieldClass("password")}
                autoComplete="new-password"
              />
              <FieldError message={errors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
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
