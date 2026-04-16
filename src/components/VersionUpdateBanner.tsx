import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function VersionUpdateBanner() {
  const [autoUpdated, setAutoUpdated] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 30 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 30 * 1000);
      }
    },
  });

  // Auto-update when new version detected
  useEffect(() => {
    if (needRefresh && !autoUpdated) {
      setAutoUpdated(true);
      toast.success("✓ Sistema atualizado!", { duration: 2000 });
      // Small delay so toast is visible before reload
      setTimeout(() => {
        updateServiceWorker(true);
      }, 2000);
    }
  }, [needRefresh, autoUpdated, updateServiceWorker]);

  return null;
}

export function forceCheckUpdate() {
  if ("caches" in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.update());
    });
  }
  window.location.reload();
}
