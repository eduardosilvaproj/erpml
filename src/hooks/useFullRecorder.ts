import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RecorderStatus = "idle" | "ready" | "recording" | "paused" | "stopped" | "uploading";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export const useFullRecorder = () => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const listCameras = useCallback(async () => {
    try {
      // Solicita permissão para que os labels apareçam
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tmp.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const list = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Câmera ${i + 1}` }));
      setCameras(list);
      return list;
    } catch (e: any) {
      setError(e?.message || "Permissão de câmera negada");
      return [];
    }
  }, []);

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    const tryAttach = async (attempt = 0): Promise<void> => {
      const v = videoRef.current;
      if (!v) {
        if (attempt < 20) {
          await new Promise((r) => setTimeout(r, 50));
          return tryAttach(attempt + 1);
        }
        return;
      }
      v.srcObject = stream;
      v.muted = true;
      v.autoplay = true;
      v.playsInline = true;
      try { await v.play(); } catch { /* ignored */ }
    };
    await tryAttach();
  }, []);

  const start = useCallback(async (deviceId: string) => {
    try {
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: "environment" } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus("recording");
      // Attach AFTER status change so the <video> element is mounted
      setTimeout(() => { attachStreamToVideo(stream); }, 0);
    } catch (e: any) {
      console.error("[useFullRecorder] start error:", e);
      setError(e?.message || "Não foi possível iniciar a gravação");
      setStatus("idle");
    }
  }, [attachStreamToVideo]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      if (timerRef.current) window.clearInterval(timerRef.current);
      setStatus("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus("recording");
    }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const r = recorderRef.current;
      if (!r) return resolve(null);
      r.onstop = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setStatus("stopped");
        resolve(blob);
      };
      try { r.stop(); } catch { resolve(null); }
    });
  }, []);

  const uploadAndSave = useCallback(
    async (params: {
      blob: Blob;
      companyId: string;
      userId: string;
      envioId: string;
      orderNumber: string;
      tipo: "separacao" | "despacho";
      duracaoSegundos: number;
    }) => {
      setStatus("uploading");
      const { blob, companyId, userId, envioId, orderNumber, tipo, duracaoSegundos } = params;
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const prefix = tipo === "separacao" ? "FULL" : "DESPACHO";
      const filename = `${prefix}_${orderNumber}_${dateStr}.webm`;
      const path = `${companyId}/${tipo}/${filename}`;

      const { error: upErr } = await supabase.storage
        .from("gravacoes-full")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage
        .from("gravacoes-full")
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      const { error: insErr } = await supabase.from("gravacoes_full").insert({
        company_id: companyId,
        usuario_id: userId,
        envio_id: envioId,
        tipo,
        url_video: signed?.signedUrl || path,
        storage_path: path,
        duracao_segundos: duracaoSegundos,
        tamanho_bytes: blob.size,
      });
      if (insErr) throw insErr;

      setStatus("idle");
      return { path, url: signed?.signedUrl || path };
    },
    []
  );

  const uploadStandalone = useCallback(
    async (params: { blob: Blob; companyId: string; userId: string; duracaoSegundos: number }) => {
      setStatus("uploading");
      const { blob, companyId } = params;
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `FULL_sem_ordem_${dateStr}.webm`;
      const path = `${companyId}/separacao/${filename}`;
      const { error: upErr } = await supabase.storage
        .from("gravacoes-full")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("gravacoes-full")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      setStatus("idle");
      return { path, url: signed?.signedUrl || path };
    },
    []
  );

  const reset = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current) window.clearInterval(timerRef.current);
    setSeconds(0);
    setStatus("idle");
    setError(null);
  }, []);

  useEffect(() => () => { reset(); }, [reset]);

  return { status, cameras, seconds, error, videoRef, listCameras, start, pause, resume, stop, uploadAndSave, uploadStandalone, reset };
};

export const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
};
