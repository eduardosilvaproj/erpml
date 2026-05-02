import { useState, useCallback, useRef, useEffect } from "react";

export function useBarcodeScanner() {
  const [scanValue, setScanValue] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playBeep = useCallback((frequency: number, duration: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  }, []);

  const clearScanValue = useCallback(() => {
    setScanValue("");
  }, []);

  return {
    scanValue,
    setScanValue,
    clearScanValue,
    playBeep,
  };
}
