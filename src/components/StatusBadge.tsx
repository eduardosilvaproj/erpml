import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AuditStatus = 
  | 'OK' 
  | 'Sobra' 
  | 'Falta' 
  | 'Zerar' 
  | 'Protegido' 
  | 'Ignorado'
  | 'Zerado'
  | 'Baixo'
  | 'Normal'
  | 'Pendente';

interface StatusBadgeProps {
  status: AuditStatus | string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'OK':
      case 'NORMAL':
        return { variant: 'success', label: s === 'NORMAL' ? 'Normal' : 'OK' } as const;
      case 'SOBRA':
        return { variant: 'secondary', label: 'Sobra' } as const;
      case 'FALTA':
        return { variant: 'destructive', label: 'Falta' } as const;
      case 'ZERAR':
      case 'ZERADO':
        return { variant: 'destructive', label: s === 'ZERADO' ? 'Zerado' : 'Zerar' } as const;
      case 'BAIXO':
        return { variant: 'warning', label: 'Baixo' } as const;
      case 'PROTEGIDO':
        return { variant: 'default', label: 'Protegido' } as const;
      case 'IGNORADO':
        return { variant: 'outline', label: 'Ignorado' } as const;
      case 'PENDENTE':
        return { variant: 'secondary', label: 'Pendente' } as const;
      default:
        return { variant: 'outline', label: status } as const;
    }
  };

  const { variant, label } = getStatusConfig(status);

  return (
    <Badge variant={variant} className={cn("min-w-[80px] justify-center font-medium", className)}>
      {label}
    </Badge>
  );
};
