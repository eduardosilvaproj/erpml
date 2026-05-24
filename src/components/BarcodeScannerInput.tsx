import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Camera, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BarcodeScannerInputProps {
  value: string;
  onChange: (value: string) => void;
  onScan?: (code: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  showCameraButton?: boolean;
  icon?: React.ReactNode;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "none";
  /** If true, auto-clear + refocus after each scan */
  scanMode?: boolean;
}

export interface BarcodeScannerInputHandle {
  focus: () => void;
  flash: (success: boolean) => void;
}

// Audio feedback
function playBeepSound(success: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.3;

    if (success) {
      osc.frequency.value = 800;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 100);
    } else {
      osc.frequency.value = 200;
      osc.start();
      setTimeout(() => {
        osc.frequency.value = 200;
        setTimeout(() => { osc.stop(); ctx.close(); }, 150);
      }, 150);
    }
  } catch {}
}

export const BarcodeScannerInput = forwardRef<BarcodeScannerInputHandle, BarcodeScannerInputProps>(
  (
    {
      value,
      onChange,
      onScan,
      placeholder = "Digite ou bipe o código...",
      className,
      inputClassName,
      autoFocus = false,
      autoComplete = "off",
      disabled = false,
      showCameraButton = true,
      icon,
      maxLength,
      inputMode,
      scanMode = false,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const readerRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      flash: (success: boolean) => {
        setFlashColor(success ? "green" : "red");
        playBeepSound(success);
        setTimeout(() => setFlashColor(null), 500);
      },
    }));

    useEffect(() => {
      if (autoFocus) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && value.trim()) {
        e.preventDefault();
        onScan?.(value.trim());
        if (scanMode) {
          onChange("");
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    };

    const handleCameraResult = useCallback(
      (code: string) => {
        setCameraOpen(false);
        onChange(code);
        onScan?.(code);
        if (scanMode) {
          setTimeout(() => {
            onChange("");
            inputRef.current?.focus();
          }, 100);
        }
      },
      [onChange, onScan, scanMode]
    );

    // Start camera scanning with @zxing/browser
    const startCamera = useCallback(async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        // Wait for video element to be in DOM
        await new Promise((r) => setTimeout(r, 300));
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        const backCamera = cameras.find(
          (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("traseira")
        );
        const deviceId = backCamera?.deviceId || cameras[0]?.deviceId;

        const controls = await reader.decodeFromVideoDevice(
          deviceId || undefined,
          videoEl,
          (result) => {
            if (result) {
              const text = result.getText();
              if (text) {
                controls.stop();
                handleCameraResult(text);
              }
            }
          }
        );
      } catch (err) {
        console.error("Camera error:", err);
        setCameraOpen(false);
      }
    }, [handleCameraResult]);

    const stopCamera = useCallback(() => {
      if (readerRef.current) {
        try {
          // BrowserMultiFormatReader controls are stopped via the controls object
          // but we also stop any remaining streams
        } catch {}
        readerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Also stop any video element streams
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    }, []);

    useEffect(() => {
      if (cameraOpen) {
        startCamera();
      } else {
        stopCamera();
      }
      return () => stopCamera();
    }, [cameraOpen, startCamera, stopCamera]);

    const borderFlash = flashColor === "green"
      ? "ring-2 ring-emerald-500 border-emerald-500"
      : flashColor === "red"
        ? "ring-2 ring-destructive border-destructive"
        : "";

    return (
      <>
        <div className={cn("relative flex items-center", className)}>
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
              {icon}
            </div>
          )}
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "transition-all duration-300",
              icon ? "pl-11" : "",
              showCameraButton ? "pr-11" : "",
              borderFlash,
              inputClassName
            )}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            disabled={disabled}
            maxLength={maxLength}
            inputMode={inputMode}
          />
          {showCameraButton && (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="Abrir câmera para escanear"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Camera Dialog */}
        <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) setCameraOpen(false); }}>
          <DialogContent className="max-w-md p-0 overflow-hidden bg-black/95 border-border">
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle className="text-sm text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Escanear código
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/10"
                  onClick={() => setCameraOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full aspect-[4/3] object-cover"
                playsInline
                muted
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[70%] h-[40%] border-2 border-primary/60 rounded-lg">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-lg" />
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground py-2 bg-background">
              Aponte a câmera para o código de barras ou QR Code
            </p>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

BarcodeScannerInput.displayName = "BarcodeScannerInput";
