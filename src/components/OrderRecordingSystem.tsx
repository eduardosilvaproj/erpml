import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Video, VideoOff, History, Play, Trash2, X, Maximize2, Minimize2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useOrderRecording, RecordingType } from "@/hooks/useOrderRecording";
import { useOrderRecordings, OrderRecording } from "@/hooks/useOrderRecordings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface OrderRecordingSystemHandle {
  startRecording: (type: RecordingType) => void;
  stopRecording: () => void;
  isRecording: boolean;
  duration: number;
}

interface OrderRecordingSystemProps {
  pedidoId: string;
  orderNumber?: string;
  freteMl?: string | null;
  trigger?: React.ReactNode;
  defaultType?: RecordingType;
  onFinished?: (url: string) => void;
  onRecordingChange?: (isRecording: boolean, duration: number) => void;
  viewOnly?: boolean;
}

export const OrderRecordingSystem = forwardRef<OrderRecordingSystemHandle, OrderRecordingSystemProps>(({ 
  pedidoId, 
  orderNumber, 
  freteMl, 
  trigger, 
  defaultType = "carregamento", 
  onFinished,
  onRecordingChange,
  viewOnly = false
}, ref) => {

  const [activeType, setActiveType] = useState<RecordingType>(defaultType);

  const { 
    isRecording, 
    duration, 
    stream, 
    startRecording, 
    stopRecording, 
    isUploading 
  } = useOrderRecording({
    pedidoId,
    tipo: activeType,
    freteMl,
    onFinished
  });

  useEffect(() => {
    if (onRecordingChange) {
      onRecordingChange(isRecording, duration);
    }
  }, [isRecording, duration, onRecordingChange]);

  useImperativeHandle(ref, () => ({
    startRecording: (type: RecordingType) => {
      setActiveType(type);
      startRecording(type);
    },
    stopRecording: () => {
      stopRecording();
    },
    isRecording,
    duration
  }));

  const { recordings, isLoading, deleteRecording } = useOrderRecordings(pedidoId);
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = (type: RecordingType) => {
    setActiveType(type);
    startRecording(type);
  };

  const handleToggleTopRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      handleStartRecording("carregamento");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 w-full">
        {!trigger && (
          <div className="flex flex-col w-full gap-2">
            <Button 
              variant={isRecording ? "destructive" : "default"} 
              size="lg" 
              className={`w-full h-16 text-lg font-black gap-3 rounded-xl shadow-lg transition-all hover:scale-[1.01] ${
                isRecording 
                  ? "bg-destructive animate-pulse" 
                  : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
              }`}
              onClick={handleToggleTopRecording}
              disabled={isUploading}
            >
              {isRecording ? (
                <>
                  <VideoOff className="h-6 w-6" /> 
                  <span>Parar Gravação</span>
                  <span className="ml-2 font-mono text-base tabular-nums">● {formatDuration(duration)}</span>
                </>
              ) : (
                <>
                  <Video className="h-6 w-6" /> 🎥 Gravar Carregamento
                </>
              )}
            </Button>
          </div>
        )}


        <Dialog>
          <DialogTrigger asChild>
            {trigger || (
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" /> Histórico
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sistema de Gravação — Pedido {orderNumber ? `#${orderNumber}` : ""}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {selectedVideo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedVideo(null)} className="gap-2">
                      <X className="h-4 w-4" /> Voltar para lista
                    </Button>
                    <span className="text-xs text-muted-foreground">Reproduzindo gravação</span>
                  </div>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden border">
                    <video 
                      src={selectedVideo} 
                      controls 
                      autoPlay 
                      className="w-full h-full"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <RecordingSection 
                    title="Separação" 
                    type="separacao" 
                    recordings={recordings?.filter(r => r.tipo === "separacao") || []}
                    onDelete={deleteRecording}
                    onStartRecording={() => handleStartRecording("separacao")}
                    isRecording={isRecording}
                    viewOnly={viewOnly}
                    onPlay={(url) => setSelectedVideo(url)}
                  />
                  
                  <RecordingSection 
                    title="Carregamento" 
                    type="carregamento" 
                    recordings={recordings?.filter(r => r.tipo === "carregamento") || []}
                    onDelete={deleteRecording}
                    onStartRecording={() => handleStartRecording("carregamento")}
                    isRecording={isRecording}
                    viewOnly={viewOnly}
                    onPlay={(url) => setSelectedVideo(url)}
                  />
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Preview Window - Draggable */}
      {isRecording && stream && (
        <DraggablePreview 
          stream={stream} 
          duration={duration} 
          formatDuration={formatDuration}
          isPreviewMinimized={isPreviewMinimized}
          setIsPreviewMinimized={setIsPreviewMinimized}
        />
      )}
    </>
  );
});

OrderRecordingSystem.displayName = "OrderRecordingSystem";

function DraggablePreview({ 
  stream, 
  duration, 
  formatDuration,
  isPreviewMinimized,
  setIsPreviewMinimized
}: { 
  stream: MediaStream; 
  duration: number;
  formatDuration: (s: number) => string;
  isPreviewMinimized: boolean;
  setIsPreviewMinimized: (v: boolean) => void;
}) {
  const [pos, setPos] = useState({ x: window.innerWidth - 280, y: 20 });
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    offset.current = {
      x: clientX - pos.x,
      y: clientY - pos.y
    };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    setPos({
      x: clientX - offset.current.x,
      y: clientY - offset.current.y
    });
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
      className={`transition-shadow duration-300 ${isDragging.current ? 'shadow-2xl' : ''}`}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
    >
      <Card className={`overflow-hidden border-2 border-primary shadow-2xl relative transition-all duration-300 ${isPreviewMinimized ? 'w-16 h-16' : 'w-64 aspect-video'}`}>
        {!isPreviewMinimized && (
          <div className="bg-slate-900 px-2 py-1 flex items-center justify-between border-b border-primary/20">
            <span className="text-[10px] font-bold text-primary flex items-center gap-1">
              <span className="text-xs">⠿</span> 🎥 Gravando
            </span>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[10px] font-mono text-destructive">{formatDuration(duration)}</span>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-5 w-5 rounded-full hover:bg-primary/20 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPreviewMinimized(true);
                }}
              >
                <Minimize2 className="h-3 w-3 text-primary" />
              </Button>
            </div>
          </div>
        )}

        <div className="absolute top-1 right-1 z-10">
          {isPreviewMinimized && (
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-6 w-6 rounded-full opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewMinimized(false);
              }}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {!isPreviewMinimized && (
          <VideoPreview stream={stream} />
        )}
        
        {isPreviewMinimized && (
          <div className="w-full h-full bg-primary flex flex-col items-center justify-center gap-0.5">
            <Video className="text-primary-foreground h-5 w-5 animate-pulse" />
            <span className="text-[8px] font-mono text-primary-foreground leading-none">{formatDuration(duration)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function VideoPreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video 
      ref={videoRef}
      autoPlay 
      muted 
      playsInline
      className="w-full h-full object-cover bg-black pointer-events-none"
    />
  );
}

interface RecordingSectionProps {
  title: string;
  type: RecordingType;
  recordings: OrderRecording[];
  onDelete: (rec: OrderRecording) => void;
  onStartRecording: () => void;
  isRecording: boolean;
  viewOnly?: boolean;
  onPlay: (url: string) => void;
}

function RecordingSection({ 
  title, 
  recordings, 
  onDelete, 
  onStartRecording, 
  isRecording, 
  viewOnly,
  onPlay
}: RecordingSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {title === "Separação" ? "📦" : "🚛"} Gravação da {title}
      </h3>
      
      <div className="border rounded-lg p-4 space-y-4">
        {recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 bg-muted/20 rounded-md border border-dashed">
            {!viewOnly && (
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={onStartRecording}
                disabled={isRecording}
              >
                <Play className="h-4 w-4" /> Iniciar gravação de {title.toLowerCase()}
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-2">Nenhuma gravação salva</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Video className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {title} — {format(new Date(rec.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Duração: {Math.floor(rec.duracao_segundos / 60)}min {rec.duracao_segundos % 60}s · Responsável: {rec.profiles?.full_name || 'Desconhecido'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onPlay(rec.video_url)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  {!viewOnly && (
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(rec)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {!viewOnly && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2" 
                onClick={onStartRecording}
                disabled={isRecording}
              >
                <Play className="h-4 w-4" /> Nova gravação de {title.toLowerCase()}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}