import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState(false);

  const validate = (v: string) => {
    if (!v.trim()) return "Informe seu e-mail";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Formato de e-mail inválido";
    return undefined;
  };

  const handleChange = (v: string) => {
    setEmail(v);
    if (touched) setError(validate(v));
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validate(email));
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    setError(err);
    setTouched(true);
    if (err) return;

    setLoading(true);
    const { error: apiError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (apiError) {
      toast.error(translateAuthError(apiError.message));
    } else {
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Esqueci a senha</CardTitle>
          <CardDescription>Informe seu e-mail para recuperar o acesso</CardDescription>
        </CardHeader>
        <form onSubmit={handleReset} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="email"
              />
              <FieldError message={error} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Enviar e-mail de recuperação
            </Button>
            <Link to="/login" className="text-sm text-primary hover:underline">Voltar ao login</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
