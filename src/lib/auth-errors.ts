// Maps Supabase auth error messages to user-friendly Portuguese
const errorMap: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos. Verifique seus dados e tente novamente.",
  "Email not confirmed": "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.",
  "User already registered": "Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.",
  "Signup requires a valid password": "A senha informada é inválida. Use no mínimo 6 caracteres.",
  "Password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres.",
  "Unable to validate email address: invalid format": "O formato do e-mail é inválido. Verifique e tente novamente.",
  "For security purposes, you can only request this once every 60 seconds": "Por segurança, aguarde 60 segundos antes de tentar novamente.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
  "User not found": "Nenhuma conta encontrada com este e-mail.",
  "New password should be different from the old password.": "A nova senha deve ser diferente da senha atual.",
  "Auth session missing!": "Sessão expirada. Faça login novamente.",
  "Token has expired or is invalid": "Link expirado ou inválido. Solicite um novo link de recuperação.",
};

export function translateAuthError(message: string): string {
  return errorMap[message] || `Erro: ${message}. Tente novamente ou entre em contato com o suporte.`;
}
