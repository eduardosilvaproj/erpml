import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "OK" | "Divergente" | "Não bipado" | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case "OK":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 gap-1 px-2 py-0.5">
          <CheckCircle className="h-3 w-3" />
          <span>OK</span>
        </Badge>
      );
    case "Divergente":
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 gap-1 px-2 py-0.5">
          <AlertTriangle className="h-3 w-3" />
          <span>Divergente</span>
        </Badge>
      );
    case "Não bipado":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 gap-1 px-2 py-0.5">
          <XCircle className="h-3 w-3" />
          <span>Não bipado</span>
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};
