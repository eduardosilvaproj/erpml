import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  disabled?: boolean;
}

export function BarcodeScanner({ onScan, disabled }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (disabled) return;
    setIsStarting(true);
    setError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Stop existing scanner if any
      await stopScanner();

      const scannerId = "barcode-scanner-" + Math.random().toString(36).slice(2, 8);

      // Create container element
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        const div = document.createElement("div");
        div.id = scannerId;
        containerRef.current.appendChild(div);
      }

      const html5Qrcode = new Html5Qrcode(scannerId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText: string) => {
          // Debounce: ignore same code within 2 seconds
          const now = Date.now();
          if (decodedText === lastCodeRef.current && now - lastTimeRef.current < 2000) {
            return;
          }
          lastCodeRef.current = decodedText;
          lastTimeRef.current = now;
          onScan(decodedText);
        },
        () => {} // ignore errors (no QR found each frame)
      );

      setIsOpen(true);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Permissão de câmera negada. Permita o acesso nas configurações do navegador.");
      } else if (msg.includes("NotFoundError") || msg.includes("no camera")) {
        setError("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setError("Erro ao iniciar câmera: " + msg);
      }
    } finally {
      setIsStarting(false);
    }
  }, [disabled, onScan, stopScanner]);

  const handleToggle = async () => {
    if (isOpen) {
      await stopScanner();
      setIsOpen(false);
    } else {
      await startScanner();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={isOpen ? "default" : "outline"}
        size="lg"
        className="h-14 gap-2"
        onClick={handleToggle}
        disabled={disabled || isStarting}
      >
        {isStarting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isOpen ? (
          <CameraOff className="h-5 w-5" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
        {isStarting ? "Abrindo..." : isOpen ? "Fechar Câmera" : "Câmera"}
      </Button>

      {isOpen && (
        <div className="rounded-lg overflow-hidden border bg-black">
          <div ref={containerRef} className="w-full max-w-[400px] mx-auto" />
          <p className="text-center text-xs text-muted-foreground py-1 bg-background">
            Aponte a câmera para o código de barras
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}