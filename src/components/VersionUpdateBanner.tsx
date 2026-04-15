import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

export function VersionUpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 60 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
  });

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg border border-primary/20">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">Nova versão disponível!</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-xs font-bold bg-primary-foreground/20 hover:bg-primary-foreground/30 px-3 py-1 rounded-lg transition-colors"
        >
          Atualizar agora
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-primary-foreground/20 rounded transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
