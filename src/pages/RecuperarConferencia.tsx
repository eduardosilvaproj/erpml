import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Loader2, Play, Search, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllConferenceItems, mapConferenceItemsToScannedProducts } from "@/lib/conference-recovery";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConferenceRecoveryRow {
  id: string;
  nome: string | null;
  status: string;
  tipo: string;
  updated_at: string;
  started_at: string;
  criado_por: string | null;
  total_rows: number;
  distinct_products: number;
}

const RecuperarConferencia = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [rows, setRows] = useState<ConferenceRecoveryRow[]>([]);

  const loadRecoverable = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: confs, error } = await supabase
        .from("conferences")
        .select("id, nome, status, tipo, updated_at, started_at, criado_por")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const enriched: ConferenceRecoveryRow[] = [];
      for (const c of confs ?? []) {
        const { count: totalRows } = await supabase
          .from("conference_items")
          .select("id", { count: "exact", head: true })
          .eq("conference_id", c.id);

        let distinct = 0;
        try {
          const { data: distinctData } = await supabase.rpc(
            "get_conference_distinct_product_count",
            { _conference_id: c.id },
          );
          distinct = Number(distinctData ?? 0);
        } catch {
          distinct = 0;
        }

        enriched.push({
          id: c.id,
          nome: c.nome ?? null,
          status: c.status as string,
          tipo: c.tipo as string,
          updated_at: c.updated_at as string,
          started_at: c.started_at as string,
          criado_por: (c as any).criado_por ?? null,
          total_rows: Number(totalRows ?? 0),
          distinct_products: distinct,
        });
      }

      setRows(enriched);
    } catch (err: any) {
      toast({
        title: "Não foi possível carregar conferências",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecoverable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    let list = rows;
    if (onlyMine && user?.id) list = list.filter((r) => r.criado_por === user.id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.nome ?? "").toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, onlyMine, search, user?.id]);

  const restore = async (row: ConferenceRecoveryRow) => {
    setRestoring(row.id);
    try {
      const rawItems = await fetchAllConferenceItems(row.id, "RecuperarConferencia");
      const scannedProducts = mapConferenceItemsToScannedProducts(rawItems);

      const totalBips = scannedProducts.reduce((sum, item) => sum + item.scannedQty, 0);
      const uniqueProducts = new Set(rawItems.map((item) => item.product_id)).size;

      const session = {
        step: 2,
        mode: row.tipo === "inventario" ? "inventario" : "nf",
        conferenceName: row.nome ?? `Conferência ${row.id.slice(0, 6)}`,
        conferenceId: row.id,
        scannedProducts,
        distinctProductsCount: uniqueProducts,
        totalBips,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem("conferencia-session-v1", JSON.stringify(session));
      toast({
        title: "Conferência restaurada",
        description: `${uniqueProducts} produtos diferentes • ${totalBips} bips carregados.`,
      });
      navigate("/conferencia");
    } catch (err: any) {
      toast({
        title: "Erro ao restaurar conferência",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };

  const statusLabel: Record<string, string> = {
    em_andamento: "Em andamento",
    pausada: "Pausada",
    conferida: "Conferida",
    divergente: "Divergente",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Recuperar conferência</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conferências salvas no banco</CardTitle>
          <p className="text-xs text-muted-foreground">
            Os bips ficam salvos automaticamente. Mesmo que a tela tenha sido recarregada,
            você consegue retomar exatamente de onde parou.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, ID ou status"
                className="pl-8"
              />
            </div>
            <Button
              variant={onlyMine ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyMine((v) => !v)}
            >
              {onlyMine ? "Mostrando minhas" : "Apenas minhas"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadRecoverable} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recarregar"}
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Buscando conferências…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma conferência encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((row) => {
                const isMine = user?.id && row.criado_por === user.id;
                const ativa = row.status === "em_andamento" || row.status === "pausada";
                return (
                  <div
                    key={row.id}
                    className={`rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                      ativa ? "bg-primary/5 border-primary/40" : "bg-card"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold truncate">
                          {row.nome ?? `Conferência ${row.id.slice(0, 6)}`}
                        </span>
                        <Badge variant={ativa ? "default" : "outline"}>
                          {statusLabel[row.status] ?? row.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {row.tipo === "inventario" ? "Inventário" : "Nota fiscal"}
                        </Badge>
                        {isMine && (
                          <Badge variant="secondary" className="text-xs">Minha</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {row.distinct_products.toLocaleString("pt-BR")} produtos diferentes
                        </span>
                        <span>{row.total_rows.toLocaleString("pt-BR")} bips no banco</span>
                        <span>
                          atualizado{" "}
                          {formatDistanceToNow(new Date(row.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => restore(row)}
                      disabled={restoring === row.id}
                      className="shrink-0"
                    >
                      {restoring === row.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restaurando…
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" /> Restaurar
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecuperarConferencia;
