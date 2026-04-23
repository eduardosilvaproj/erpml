import { useState, useRef, useEffect } from "react";
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

interface OrderRecordingSystemProps {
  pedidoId: string;
  orderNumber?: string;
  trigger?: React.ReactNode;
}

export function OrderRecordingSystem({ pedidoId, orderNumber, trigger }: OrderRecordingSystemProps) {
  const [activeType, setActiveType] = useState<RecordingType>("separacao");
  
  const { 
    isRecording, 
    duration, 
    stream, 
    startRecording, 
    stopRecording, 
    isUploading 
  } = useOrderRecording({
    pedidoId,
    tipo: activeType
  });

  const { recordings, isLoading, deleteRecording } = useOrderRecordings(pedidoId);
  const [isPreviewMinimized, setIsPreviewMinimized] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = (type: RecordingType) => {
    setActiveType(type);
    // Pass type directly to avoid race condition with state
    startRecording(type);
  };

  const handleToggleTopRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      handleStartRecording("separacao");
    }
  };

  return (
    <>
  const systemUI = (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-px">
        <Button 
          variant={isRecording ? "destructive" : "outline"} 
          size="sm" 
          className={`gap-2 rounded-r-none ${isRecording ? "animate-pulse" : ""}`}
          onClick={handleToggleTopRecording}
          disabled={isUploading}
        >
          {isRecording ? (
            <>
              <VideoOff className="h-4 w-4" /> 
              <span>Parar Gravação</span>
              <span className="ml-1 font-mono text-xs tabular-nums">● {formatDuration(duration)}</span>
            </>
          ) : (
            <>
              <Video className="h-4 w-4" /> Iniciar {activeType === 'separacao' ? 'Separação' : 'Carregamento'}
            </>
          )}
        </Button>
        
        {!isRecording && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2 rounded-l-none border-l-0" disabled={isUploading}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStartRecording("separacao")}>
                <Video className="mr-2 h-4 w-4" /> Gravar Separação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStartRecording("carregamento")}>
                <Video className="mr-2 h-4 w-4" /> Gravar Carregamento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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
              <RecordingSection 
                title="Separação" 
                type="separacao" 
                recordings={recordings?.filter(r => r.tipo === "separacao") || []}
                onDelete={deleteRecording}
                onStartRecording={() => handleStartRecording("separacao")}
                isRecording={isRecording}
              />
              
              <RecordingSection 
                title="Carregamento" 
                type="carregamento" 
                recordings={recordings?.filter(r => r.tipo === "carregamento") || []}
                onDelete={deleteRecording}
                onStartRecording={() => handleStartRecording("carregamento")}
                isRecording={isRecording}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Preview Window */}
      {isRecording && stream && (
        <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isPreviewMinimized ? 'w-16 h-16' : 'w-64 aspect-video'}`}>
          <Card className="overflow-hidden border-2 border-primary shadow-2xl relative">
            <div className="absolute top-1 right-1 z-10 flex gap-1">
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-6 w-6 rounded-full opacity-70 hover:opacity-100"
                onClick={() => setIsPreviewMinimized(!isPreviewMinimized)}
              >
                {isPreviewMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
            </div>
            
            {!isPreviewMinimized && (
              <VideoPreview stream={stream} />
            )}
            
            {isPreviewMinimized && (
              <div className="w-full h-full bg-primary flex items-center justify-center">
                <Video className="text-primary-foreground h-6 w-6 animate-pulse" />
              </div>
            )}
            
            <div className="absolute bottom-1 left-2 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
              <span className="text-[10px] font-bold text-primary-foreground drop-shadow-md">{formatDuration(duration)}</span>
            </div>
          </Card>
        </div>
      )}
    </>
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
      className="w-full h-full object-cover bg-black"
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
}

function RecordingSection({ title, recordings, onDelete, onStartRecording, isRecording }: RecordingSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {title === "Separação" ? "📦" : "🚛"} Gravação da {title}
      </h3>
      
      <div className="border rounded-lg p-4 space-y-4">
        {recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 bg-muted/20 rounded-md border border-dashed">
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={onStartRecording}
              disabled={isRecording}
            >
              <Play className="h-4 w-4" /> Iniciar gravação de {title.toLowerCase()}
            </Button>
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
                  <Button variant="ghost" size="icon" onClick={() => window.open(rec.video_url, "_blank")}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(rec)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2" 
              onClick={onStartRecording}
              disabled={isRecording}
            >
              <Play className="h-4 w-4" /> Nova gravação de {title.toLowerCase()}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
