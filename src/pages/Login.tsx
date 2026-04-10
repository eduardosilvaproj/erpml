import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { translateAuthError } from "@/lib/auth-errors";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/", { replace: true });
    }
  }, [session, authLoading, navigate]);

  const validateEmail = (value: string) => {
    if (!value.trim()) return "Informe seu e-mail";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Formato de e-mail inválido";
    return undefined;
  };

  const validatePassword = (value: string) => {
    if (!value) return "Informe sua senha";
    if (value.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    return undefined;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (touched.email) setErrors(prev => ({ ...prev, email: validateEmail(value) }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (touched.password) setErrors(prev => ({ ...prev, password: validatePassword(value) }));
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const val = field === "email" ? email : password;
    const validator = field === "email" ? validateEmail : validatePassword;
    setErrors(prev => ({ ...prev, [field]: validator(val) }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setErrors({ email: emailErr, password: passwordErr });
    setTouched({ email: true, password: true });
    if (emailErr || passwordErr) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      toast.error(translateAuthError(error.message));
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Entrar</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur("email")}
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="email"
              />
              <FieldError message={errors.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="current-password"
              />
              <FieldError message={errors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              Entrar
            </Button>
            <div className="flex justify-between w-full text-sm">
              <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
              <Link to="/forgot-password" className="text-muted-foreground hover:underline">Esqueci a senha</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
