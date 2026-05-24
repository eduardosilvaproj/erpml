import { useState } from "react";
import { APP_VERSION, MIN_REQUIRED_VERSION } from "@/config/version";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateRequiredModal() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 1. Clear app caches
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // 2. Unregister service workers (preview/PWA)
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // 3. Clear stored app version so main.tsx detects fresh load
      try {
        localStorage.removeItem("erp-app-version");
        sessionStorage.clear();
      } catch {}
    } catch (err) {
      console.error("[UpdateRequiredModal] cleanup error:", err);
    }

    // 4. Hard reload with cache-bust query string
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
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
        <Button onClick={handleRefresh} className="w-full" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Atualizar agora</>
          )}
        </Button>
      </div>
    </div>
  );
}
