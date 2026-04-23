import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type RecordingType = "separacao" | "carregamento";

interface UseOrderRecordingProps {
  pedidoId: string;
  tipo: RecordingType;
  onFinished?: (url: string) => void;
}

export const useOrderRecording = ({ pedidoId, tipo, onFinished }: UseOrderRecordingProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const tipoRef = useRef(tipo);

  // Sync tipoRef with the latest tipo prop
  useEffect(() => {
    tipoRef.current = tipo;
  }, [tipo]);

  const startRecording = async (overrideTipo?: RecordingType) => {
    if (overrideTipo) {
      tipoRef.current = overrideTipo;
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
      
      setStream(mediaStream);
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: "video/webm;codecs=vp8,opus"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
        // Use the current value of the ref to avoid closure issues
        await uploadVideo(videoBlob, durationRef.current, tipoRef.current);
        
        // Stop all tracks
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      durationRef.current = 0;
      
      timerRef.current = window.setInterval(() => {
        setDuration(prev => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);

    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      toast({
        title: "Erro ao acessar câmera",
        description: "Certifique-se de que deu permissão para usar a câmera e o microfone.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadVideo = async (blob: Blob, finalDuration: number, uploadTipo: RecordingType) => {
    setIsUploading(true);
    const timestamp = new Date().getTime();
    const fileName = `${uploadTipo}_${timestamp}.webm`;
    const filePath = `${pedidoId}/${fileName}`;

    try {
      // 1. Upload to Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from("order_recordings")
        .upload(filePath, blob);

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from("order_recordings")
        .getPublicUrl(filePath);

      // 2. Save to Database
      const { error: dbError } = await supabase
        .from("order_recordings")
        .insert({
          pedido_id: pedidoId,
          tipo: uploadTipo,
          video_url: publicUrl,
          duracao_segundos: finalDuration
        });

      if (dbError) throw dbError;

      toast({
        title: "Gravação salva!",
        description: `O vídeo de ${uploadTipo === 'separacao' ? 'separação' : 'carregamento'} foi vinculado ao pedido com sucesso.`,
      });

      if (onFinished) onFinished(publicUrl);

    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast({
        title: "Erro ao salvar gravação",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isUploading,
    duration,
    stream,
    startRecording,
    stopRecording
  };
};
