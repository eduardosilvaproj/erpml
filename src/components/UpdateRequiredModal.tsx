import { APP_VERSION, MIN_REQUIRED_VERSION } from "@/config/version";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateRequiredModal() {
  const handleRefresh = () => {
    // Clear caches and force reload
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
        <RefreshCw className="mx-auto mb-4 h-12 w-12 text-primary animate-spin" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Atualização Necessária
        </h2>
        <p className="text-sm text-muted-foreground mb-1">
          Sua versão ({APP_VERSION}) está desatualizada.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          A versão mínima requerida é {MIN_REQUIRED_VERSION}.
        </p>
        <Button onClick={handleRefresh} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar agora
        </Button>
      </div>
    </div>
  );
}
