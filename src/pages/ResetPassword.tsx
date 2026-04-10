import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";
import { PasswordStrength } from "@/components/PasswordStrength";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive mt-1">{message}</p>;
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      toast.error("Link de recuperação inválido.");
      navigate("/login");
    }
  }, [navigate]);

  const validatePassword = (v: string) => {
    if (!v) return "Informe a nova senha";
    if (v.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    return undefined;
  };

  const validateConfirm = (v: string, pwd: string) => {
    if (!v) return "Confirme sua nova senha";
    if (v !== pwd) return "As senhas não coincidem";
    return undefined;
  };

  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (touched.password) setErrors(prev => ({ ...prev, password: validatePassword(v) }));
    if (touched.confirm && confirm) setErrors(prev => ({ ...prev, confirm: validateConfirm(confirm, v) }));
  };

  const handleConfirmChange = (v: string) => {
    setConfirm(v);
    if (touched.confirm) setErrors(prev => ({ ...prev, confirm: validateConfirm(v, password) }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === "password") setErrors(prev => ({ ...prev, password: validatePassword(password) }));
    if (field === "confirm") setErrors(prev => ({ ...prev, confirm: validateConfirm(confirm, password) }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = {
      password: validatePassword(password),
      confirm: validateConfirm(confirm, password),
    };
    setErrors(newErrors);
    setTouched({ password: true, confirm: true });
    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(translateAuthError(error.message));
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Nova senha</CardTitle>
          <CardDescription>Defina sua nova senha</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdate} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur("password")}
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="new-password"
              />
              <FieldError message={errors.password} />
              <PasswordStrength password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repita a senha"
                value={confirm}
                onChange={(e) => handleConfirmChange(e.target.value)}
                onBlur={() => handleBlur("confirm")}
                className={errors.confirm ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="new-password"
              />
              <FieldError message={errors.confirm} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Atualizar senha
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
