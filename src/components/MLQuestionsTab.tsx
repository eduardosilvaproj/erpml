import { useState } from "react";
import { MessageSquare, Send, RefreshCw, Loader2, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMLQuestions, useSyncMLQuestions, useAnswerMLQuestion, useSuggestMLAnswer } from "@/hooks/useMLData";

export default function MLQuestionsTab() {
  const { toast } = useToast();
  const { data: questions, isLoading } = useMLQuestions();
  const syncQuestions = useSyncMLQuestions();
  const answerQuestion = useAnswerMLQuestion();
  const suggestAnswer = useSuggestMLAnswer();
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");

  const handleSync = async () => {
    try {
      const result = await syncQuestions.mutateAsync();
      toast({
        title: "Perguntas sincronizadas!",
        description: `${result.inserted} novas, ${result.updated} atualizadas de ${result.total_in_ml} total.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    }
  };

  const handleAnswer = async (mlQuestionId: number) => {
    if (!answerText.trim()) return;
    try {
      await answerQuestion.mutateAsync({ questionId: mlQuestionId, text: answerText.trim() });
      toast({ title: "Resposta enviada!" });
      setAnsweringId(null);
      setAnswerText("");
    } catch (err: any) {
      toast({ title: "Erro ao responder", description: err.message, variant: "destructive" });
    }
  };

  const handleSuggestAnswer = async (q: any) => {
    try {
      const result = await suggestAnswer.mutateAsync({
        questionText: q.question_text,
        itemTitle: q.ml_item_title ?? undefined,
        itemId: q.ml_item_id ?? undefined,
      });
      if (result.suggestion) {
        setAnswerText(result.suggestion);
        setAnsweringId(q.ml_question_id);
        toast({ title: "Sugestão gerada!", description: "Revise e edite antes de enviar." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar sugestão", description: err.message, variant: "destructive" });
    }
  };

  const unanswered = questions?.filter((q) => q.status !== "answered") ?? [];
  const answered = questions?.filter((q) => q.status === "answered") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Perguntas do Mercado Livre</h3>
          {unanswered.length > 0 && (
            <Badge variant="destructive">{unanswered.length} pendente(s)</Badge>
          )}
        </div>
        <Button onClick={handleSync} disabled={syncQuestions.isPending} variant="outline" size="sm">
          {syncQuestions.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar Perguntas
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !questions?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Nenhuma pergunta encontrada</p>
            <p className="text-sm">Clique em "Sincronizar Perguntas" para importar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {unanswered.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" /> Pendentes ({unanswered.length})
              </h4>
              {unanswered.map((q: any) => (
                <Card key={q.id} className="border-destructive/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          {q.ml_from_nickname ?? "Comprador"} • {q.ml_item_title ?? q.ml_item_id} •{" "}
                          {q.question_date ? new Date(q.question_date).toLocaleDateString("pt-BR") : "—"}
                        </p>
                        <p className="text-sm font-medium">{q.question_text}</p>
                      </div>
                      <Badge variant="outline" className="text-destructive border-destructive/50 shrink-0">
                        Pendente
                      </Badge>
                    </div>
                    {answeringId === q.ml_question_id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Digite sua resposta..."
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          className="min-h-[80px]"
                          maxLength={2000}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSuggestAnswer(q)}
                            disabled={suggestAnswer.isPending}
                          >
                            {suggestAnswer.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Sugerir com IA
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAnswer(q.ml_question_id)}
                            disabled={!answerText.trim() || answerQuestion.isPending}
                          >
                            {answerQuestion.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="mr-2 h-4 w-4" />
                            )}
                            Enviar Resposta
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSuggestAnswer(q)}
                          disabled={suggestAnswer.isPending}
                        >
                          {suggestAnswer.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Sugerir com IA
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setAnsweringId(q.ml_question_id); setAnswerText(""); }}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Responder
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {answered.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Respondidas ({answered.length})
              </h4>
              {answered.map((q: any) => (
                <Card key={q.id} className="opacity-80">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          {q.ml_from_nickname ?? "Comprador"} • {q.ml_item_title ?? q.ml_item_id} •{" "}
                          {q.question_date ? new Date(q.question_date).toLocaleDateString("pt-BR") : "—"}
                        </p>
                        <p className="text-sm font-medium">{q.question_text}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Respondida
                      </Badge>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs text-muted-foreground mb-1">Sua resposta:</p>
                      <p className="text-sm">{q.answer_text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
