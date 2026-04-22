import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AuditStatus = 'OK' | 'Sobra' | 'Falta' | 'Zerar' | 'Protegido' | 'Ignorado';

interface StatusBadgeProps {
  status: AuditStatus | string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OK':
        return { variant: 'success', label: 'OK' } as const;
      case 'SOBRA':
        return { variant: 'secondary', label: 'Sobra' } as const;
      case 'FALTA':
        return { variant: 'destructive', label: 'Falta' } as const;
      case 'ZERAR':
        return { variant: 'warning', label: 'Zerar' } as const;
      case 'PROTEGIDO':
        return { variant: 'default', label: 'Protegido' } as const;
      case 'IGNORADO':
        return { variant: 'outline', label: 'Ignorado' } as const;
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
