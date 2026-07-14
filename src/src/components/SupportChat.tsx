import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircleQuestion,
  Send,
  X,
  Bot,
  User,
  Loader2,
  Lightbulb,
  Mic,
  Square,
  Trash2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

type Message = {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
};

type ChatMode = "support" | "mentor";

const SUPPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-ai`;
const MENTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-ai`;
const MENTOR_STORAGE_KEY = "max_mentor_chat_history";

const SUPPORT_SUGGESTIONS = [
  "Como cadastro um produto?",
  "Como importar uma nota fiscal XML?",
  "Como funciona o estoque full?",
  "Quais são os planos disponíveis?",
];

const MENTOR_SUGGESTIONS = [
  "Como melhorar meu anúncio?",
  "Como subir de reputação?",
  "Dicas para vender mais",
  "Como calcular minha margem?",
];

const MODES = {
  support: {
    name: "Ana",
    subtitle: "Suporte do sistema",
    icon: Bot,
    gradient: "bg-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    bubbleBg: "bg-primary",
    fabIcon: MessageCircleQuestion,
    emptyIcon: Lightbulb,
    emptyTitle: "Olá! Eu sou a Ana 👋",
    emptySubtitle: "Posso te ajudar com qualquer dúvida. Digite ou use o microfone 🎤",
    placeholder: "Pergunte à Ana...",
    suggestions: SUPPORT_SUGGESTIONS,
  },
  mentor: {
    name: "Max",
    subtitle: "Mentor de vendas ML",
    icon: GraduationCap,
    gradient: "bg-amber-500/5",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
    bubbleBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    fabIcon: GraduationCap,
    emptyIcon: Sparkles,
    emptyTitle: "Olá! Sou o Max 👋",
    emptySubtitle: "Seu mentor de vendas no Mercado Livre",
    placeholder: "Pergunte ao Max...",
    suggestions: MENTOR_SUGGESTIONS,
  },
} as const;

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("support");
  const [supportMessages, setSupportMessages] = useState<Message[]>([]);
  const [mentorMessages, setMentorMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(MENTOR_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    audioUrl,
    transcript,
    startRecording,
    stopRecording,
    clearRecording,
  } = useVoiceRecorder();

  const messages = mode === "support" ? supportMessages : mentorMessages;
  const setMessages = mode === "support" ? setSupportMessages : setMentorMessages;
  const config = MODES[mode];
  const IconComp = config.icon;
  const EmptyIcon = config.emptyIcon;

  // Persist mentor messages
  useEffect(() => {
    try { localStorage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(mentorMessages)); } catch {}
  }, [mentorMessages]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, mode]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const capturedAudioUrl = audioUrl || undefined;
    const userMsg: Message = { role: "user", content: messageText, audioUrl: capturedAudioUrl };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    clearRecording();
    setIsLoading(true);

    let assistantSoFar = "";
    const chatUrl = mode === "support" ? SUPPORT_URL : MENTOR_URL;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Faça login para usar o chat.");

      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      toast.error(e.message || "Erro ao enviar mensagem");
      if (!assistantSoFar) {
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch {
        toast.error("Não foi possível acessar o microfone.");
      }
    }
  };

  const switchMode = (newMode: ChatMode) => {
    if (isLoading) return;
    setMode(newMode);
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <Button
              data-support-chat-trigger
              onClick={() => setOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow p-0"
            >
              <MessageCircleQuestion className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-background border border-border/60 rounded-2xl shadow-xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${config.gradient}`}>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full ${config.iconBg} flex items-center justify-center`}>
                  <IconComp className={`h-5 w-5 ${config.iconColor}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {config.name} — {config.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Texto ou voz • Tire suas dúvidas
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode switcher */}
            <div className="flex border-b px-2 py-1.5 gap-1 bg-muted/30">
              <button
                onClick={() => switchMode("support")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                  mode === "support"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                Ana • Suporte
              </button>
              <button
                onClick={() => switchMode("mentor")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                  mode === "mentor"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Max • Mentor ML
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className={`h-14 w-14 rounded-2xl ${config.iconBg} flex items-center justify-center`}>
                    <EmptyIcon className={`h-7 w-7 ${config.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{config.emptyTitle}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{config.emptySubtitle}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {config.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted transition-colors text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Audio hint */}
                  {messages.length >= 2 && messages.length <= 4 && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                        <Mic className="h-3 w-3 text-primary/60" />
                        <span className="text-[11px] text-muted-foreground">
                          Se quiser, pode me mandar um áudio 🎤
                        </span>
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className={`h-7 w-7 rounded-full ${config.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <IconComp className={`h-3.5 w-3.5 ${config.iconColor}`} />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-3 py-2 max-w-[85%] text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&>p:last-child]:mb-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        {msg.audioUrl && (
                          <audio
                            src={msg.audioUrl}
                            controls
                            className="mt-2 w-full h-8 [&::-webkit-media-controls-panel]:bg-primary/20 rounded-lg"
                          />
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-2">
                      <div className={`h-7 w-7 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}>
                        <IconComp className={`h-3.5 w-3.5 ${config.iconColor}`} />
                      </div>
                      <div className="bg-muted rounded-xl px-3 py-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Recording preview */}
            <AnimatePresence>
              {(isRecording || audioUrl) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t px-3 py-2 bg-muted/30 overflow-hidden"
                >
                  {isRecording ? (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                      </span>
                      <span className="text-xs text-destructive font-medium">Gravando...</span>
                      <span className="text-xs text-muted-foreground ml-auto truncate max-w-[180px]">
                        {transcript || "Fale algo..."}
                      </span>
                    </div>
                  ) : audioUrl ? (
                    <div className="flex items-center gap-2">
                      <audio
                        src={audioUrl}
                        controls
                        className="h-7 flex-1 [&::-webkit-media-controls-panel]:bg-transparent"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={clearRecording}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="border-t px-3 py-2.5 flex gap-2 items-end">
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className="shrink-0 h-[38px] w-[38px] rounded-xl transition-colors"
                onClick={handleMicClick}
                disabled={isLoading}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Textarea
                ref={inputRef}
                placeholder={config.placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none min-h-[38px] max-h-24 text-sm rounded-xl"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0 h-[38px] w-[38px] rounded-xl"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
