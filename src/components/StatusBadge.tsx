import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createContext, useContext } from "react";

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
  | 'Pendente'
  | 'Divergente'
  | 'Não bipado'
  | 'Excedente'
  | 'Desconhecido';

type BadgeSize = 'compact' | 'large' | 'default';

const StatusBadgeContext = createContext<BadgeSize>('default');

export const StatusBadgeProvider = StatusBadgeContext.Provider;

interface StatusBadgeProps {
  status: AuditStatus | string;
  className?: string;
  isAudit?: boolean;
}

export const StatusBadge = ({ status, className, isAudit: isAuditProp }: StatusBadgeProps) => {
  const contextSize = useContext(StatusBadgeContext);

  const getStatusConfig = (status: string | null | undefined) => {
    const s = (status?.trim() || "DESCONHECIDO").toUpperCase();
    
    switch (s) {
      case 'OK':
      case 'NORMAL':
        return { variant: 'success', label: s === 'NORMAL' ? 'Normal' : 'OK' } as const;
      case 'SOBRA':
      case 'EXCEDENTE':
        return { variant: 'secondary', label: s === 'EXCEDENTE' ? 'Excedente' : 'Sobra' } as const;
      case 'FALTA':
        return { variant: 'destructive', label: 'Falta' } as const;
      case 'ZERAR':
      case 'ZERADO':
        return { variant: 'destructive', label: s === 'ZERADO' ? 'Zerado' : 'Zerar' } as const;
      case 'DIVERGENTE':
      case 'BAIXO':
        return { variant: 'warning', label: s === 'DIVERGENTE' ? 'Divergente' : 'Baixo' } as const;
      case 'PROTEGIDO':
        return { variant: 'default', label: 'Protegido' } as const;
      case 'IGNORADO':
      case 'NÃO BIPADO':
      case 'NÃO ENCONTRADO':
        return { variant: 'outline', label: s === 'NÃO BIPADO' ? 'Não bipado' : s === 'NÃO ENCONTRADO' ? 'Não encontrado' : 'Ignorado' } as const;
      case 'PENDENTE':
        return { variant: 'secondary', label: 'Pendente' } as const;
      case 'DESCONHECIDO':
      case 'UNKNOWN':
      default:
        return { variant: 'secondary', label: 'Pendente', isAudit: true } as const;
    }
  };

  const config = getStatusConfig(status) as any;
  const variant = config.variant;
  const label = config.label;
  const isAudit = isAuditProp ?? config.isAudit;

  const sizeClasses = {
    compact: "min-w-0 text-[10px] h-5 px-1.5 font-bold uppercase",
    large: "min-w-[90px] text-sm h-7 px-3",
    default: "min-w-[80px] text-xs h-6 px-2.5",
  }[contextSize || 'default'];

  return (
    <Badge 
      variant={variant} 
      className={cn(
        sizeClasses, 
        isAudit && "border-dashed border-warning/60 bg-warning/20 text-warning transition-colors shadow-[0_0_10px_rgba(245,158,11,0.15)]",
        "justify-center font-medium transition-all shrink-0", 
        className
      )}
      role="status"
      aria-label={`Status: ${label}${isAudit ? ' - Modo de Auditoria Ativo' : ''}`}
    >
      {isAudit && (
        <span 
          className="mr-1.5 w-1.5 h-1.5 rounded-full bg-warning animate-pulse" 
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  );
};