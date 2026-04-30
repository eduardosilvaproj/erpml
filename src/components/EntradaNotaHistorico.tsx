import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Search, Download, FileText, RefreshCw, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

type Period = "all" | "today" | "7d" | "30d";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    importada: { label: "Confirmado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    conferida: { label: "Confirmado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    aguardando_conferencia: { label: "Pendente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    divergente: { label: "Divergente", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const m = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function tipoBadge(issuer: string | null) {
  // Heurística: notas vindas de SEFAZ têm issuer "Emitente CNPJ (UF)", XML traz nome real
  const isSefaz = !!issuer && issuer.startsWith("Emitente ");
  return isSefaz ? (
    <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30">SEFAZ</Badge>
  ) : (
    <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/30">XML</Badge>
  );
}

async function reprocessInvoice(invoiceId: string, companyId: string) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { created: 0, updated: 0, skipped: 0 };

  const pending = ((inv.invoice_items as any[]) || []).filter(
    (it: any) => !it.product_id || !it.stock_updated
  );
  let created = 0, updated = 0, skipped = 0;

  for (const it of pending) {
    const ean = (it.xml_ean || "").trim();
    const sku = (it.xml_code || `NF-${inv.number}-${Math.random().toString(36).slice(2, 6)}`).trim();
    const qty = Math.floor(Number(it.quantity) || 0);
    if (qty <= 0) { skipped++; continue; }

    let productId: string | null = it.product_id || null;
    let isNew = false;

    if (!productId && ean) {
      const { data: byEan } = await supabase
        .from("products").select("id").eq("company_id", companyId).eq("ean", ean).maybeSingle();
      if (byEan?.id) {
        productId = byEan.id;
      } else {
        const { data: byBarcode } = await supabase
          .from("products").select("id").eq("company_id", companyId).eq("barcode", ean).maybeSingle();
        if (byBarcode?.id) {
          productId = byBarcode.id;
        } else {
          const { data: byAltGtin } = await supabase
            .from("product_alternative_gtins")
            .select("product_id")
            .eq("company_id", companyId)
            .eq("gtin", ean)
            .maybeSingle();
          if (byAltGtin?.product_id) productId = byAltGtin.product_id;
        }
      }
    }
    if (!productId) {
      const { data: bySku } = await supabase
        .from("products").select("id").eq("company_id", companyId).eq("sku", sku).maybeSingle();
      if (bySku?.id) productId = bySku.id;
    }
    if (!productId) {
      const { data: createdProd, error: ce } = await supabase
        .from("products")
        .insert({
          name: (it.xml_description || "Produto sem nome").slice(0, 200),
          sku, barcode: ean || null,
          cost: Number(it.unit_value) || 0,
          price: 0, stock_physical: qty, min_stock: 0, active: true,
          company_id: companyId,
        })
        .select("id").maybeSingle();
      
      if (ce || !createdProd) { skipped++; continue; }
      productId = createdProd.id;
      isNew = true;

      // Marcar item como processado (novo produto já nasce com estoque)
      const { error: itemUpdateErr } = await supabase
        .from("invoice_items")
        .update({
          product_id: productId,
          stock_updated: true,
          match_type: "new",
        })
        .eq("id", it.id);
      
      if (!itemUpdateErr) created++;
      else skipped++;
    } else if (!it.stock_updated) {
      const { data: prod } = await supabase
        .from("products").select("stock_physical, cost").eq("id", productId).maybeSingle();
      const current = Number(prod?.stock_physical || 0);
      const currentCost = Number(prod?.cost || 0);
      const xmlUnit = Number(it.unit_value) || 0;
      const updatePayload: { stock_physical: number; cost?: number; updated_at: string } = { 
        stock_physical: current + qty,
        updated_at: new Date().toISOString()
      };
      if (currentCost === 0 && xmlUnit > 0) updatePayload.cost = Math.round(xmlUnit * 100) / 100;
      const { error: prodUpdateErr } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", productId)
        .eq("company_id", companyId);
      
      if (prodUpdateErr) { skipped++; continue; }

      // Só marca como processado se salvou estoque com sucesso
      const { error: itemUpdateErr } = await supabase
        .from("invoice_items")
        .update({
          product_id: productId,
          stock_updated: true,
          match_type: (it.match_type === "none" ? "fuzzy" : it.match_type),
        })
        .eq("id", it.id);
      
      if (!itemUpdateErr) updated++;
      else skipped++;
    }
  }

  await supabase.from("invoices").update({ status: "importada" }).eq("id", inv.id);
  return { created, updated, skipped, pendingCount: pending.length };
}

export function EntradaNotaHistorico() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reprocessingAll, setReprocessingAll] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["entrada-nota-historico", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, series, issuer_name, issuer_cnpj, total_value, items_count, status, imported_at, created_at, invoice_items(id, product_id, stock_updated)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const invoicesWithPending = useMemo(
    () => invoices.filter((i: any) =>
      ((i.invoice_items as any[]) || []).some((it: any) => !it.product_id || !it.stock_updated)
    ),
    [invoices]
  );

  const reprocessarTodas = async () => {
    if (!companyId || invoicesWithPending.length === 0) return;
    setReprocessingAll(true);
    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, processedNotes = 0;
    try {
      for (const inv of invoicesWithPending) {
        const r = await reprocessInvoice(inv.id, companyId);
        totalCreated += r.created;
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        processedNotes++;
      }
      toast({
        title: "Reprocessamento em massa concluído",
        description: `${processedNotes} nota(s): ${totalCreated} criado(s), ${totalUpdated} atualizado(s)${totalSkipped ? `, ${totalSkipped} ignorado(s)` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["entrada-nota-historico"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      toast({ title: "Erro ao reprocessar", description: e.message, variant: "destructive" });
    } finally {
      setReprocessingAll(false);
    }
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffs: Record<Period, number> = {
      all: 0,
      today: now - 1 * 24 * 60 * 60 * 1000,
      "7d": now - 7 * 24 * 60 * 60 * 1000,
      "30d": now - 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = cutoffs[period];
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (cutoff && new Date(i.created_at).getTime() < cutoff) return false;
      if (!q) return true;
      return (
        i.number?.toLowerCase().includes(q) ||
        i.issuer_name?.toLowerCase().includes(q) ||
        i.issuer_cnpj?.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, period]);

  const exportCsv = () => {
    const header = ["Data", "Numero NF", "Fornecedor", "Itens", "Valor", "Status"];
    const rows = filtered.map((i) => [
      fmtDate(i.created_at),
      i.number,
      i.issuer_name || "",
      String(i.items_count || 0),
      String(i.total_value || 0),
      i.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entradas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Separator className="my-4" />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Entradas Recentes
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Histórico das últimas notas importadas</p>
          </div>
          {invoicesWithPending.length > 0 && (
            <Button
              variant="secondary"
              onClick={reprocessarTodas}
              disabled={reprocessingAll}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${reprocessingAll ? "animate-spin" : ""}`} />
              {reprocessingAll
                ? `Reprocessando... (${invoicesWithPending.length})`
                : `Reprocessar Todas (${invoicesWithPending.length})`}
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar NF ou fornecedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando histórico...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {invoices.length === 0
                  ? "Nenhuma entrada registrada ainda. As entradas confirmadas aparecerão aqui."
                  : "Nenhuma entrada encontrada com os filtros aplicados."}
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Data</TableHead>
                      <TableHead>Nº NF</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-center">Itens</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm">{fmtDate(i.created_at)}</TableCell>
                        <TableCell className="font-medium">{i.number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">{i.issuer_name || "—"}</TableCell>
                        <TableCell className="text-center">{i.items_count}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(i.total_value))}</TableCell>
                        <TableCell>{tipoBadge(i.issuer_name)}</TableCell>
                        <TableCell>{statusBadge(i.status)}</TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(i.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(i.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DetailDialog invoiceId={detailId} onClose={() => setDetailId(null)} />
      <DeleteDialog invoiceId={deleteId} onClose={() => setDeleteId(null)} />
    </>
  );
}

function DetailDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reprocessing, setReprocessing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["entrada-nota-detalhe", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data: inv, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*, products(id, name, sku, image_url))")
        .eq("id", invoiceId!)
        .maybeSingle();
      if (error) throw error;
      return inv;
    },
  });

  const pendingItems = ((data?.invoice_items as any[]) || []).filter(
    (it: any) => !it.product_id || !it.stock_updated
  );

  const reprocessar = async () => {
    if (!data || !companyId) return;
    setReprocessing(true);
    let created = 0, updated = 0, skipped = 0;
    try {
      for (const it of pendingItems) {
        const ean = (it.xml_ean || "").trim();
        const sku = (it.xml_code || `NF-${data.number}-${Math.random().toString(36).slice(2, 6)}`).trim();
        const qty = Math.floor(Number(it.quantity) || 0);
        if (qty <= 0) { skipped++; continue; }

        let productId: string | null = it.product_id || null;
        let isNew = false;

        if (!productId && ean) {
          const { data: byEan } = await supabase
            .from("products").select("id").eq("company_id", companyId).eq("ean", ean).maybeSingle();
          if (byEan?.id) {
            productId = byEan.id;
          } else {
            const { data: byBarcode } = await supabase
              .from("products").select("id").eq("company_id", companyId).eq("barcode", ean).maybeSingle();
            if (byBarcode?.id) {
              productId = byBarcode.id;
            } else {
              const { data: byAltGtin } = await supabase
                .from("product_alternative_gtins")
                .select("product_id")
                .eq("company_id", companyId)
                .eq("gtin", ean)
                .maybeSingle();
              if (byAltGtin?.product_id) productId = byAltGtin.product_id;
            }
          }
        }
        if (!productId) {
          const { data: bySku } = await supabase
            .from("products").select("id").eq("company_id", companyId).eq("sku", sku).maybeSingle();
          if (bySku?.id) productId = bySku.id;
        }
        if (!productId) {
          const { data: createdProd, error: ce } = await supabase
            .from("products")
            .insert({
              name: (it.xml_description || "Produto sem nome").slice(0, 200),
              sku, barcode: ean || null,
              cost: Number(it.unit_value) || 0,
              price: 0, stock_physical: qty, min_stock: 0, active: true,
              company_id: companyId,
            })
            .select("id").maybeSingle();

          if (ce || !createdProd) { skipped++; continue; }
          productId = createdProd.id;
          isNew = true;

          // Marcar item como processado (novo produto já nasce com estoque)
          const { error: itemUpdateErr } = await supabase
            .from("invoice_items")
            .update({
              product_id: productId,
              stock_updated: true,
              match_type: "new",
            })
            .eq("id", it.id);
          
          if (!itemUpdateErr) created++;
          else skipped++;
        } else if (!it.stock_updated) {
          const { data: prod } = await supabase
            .from("products").select("stock_physical, cost").eq("id", productId).maybeSingle();
          const current = Number(prod?.stock_physical || 0);
          const currentCost = Number(prod?.cost || 0);
          const xmlUnit = Number(it.unit_value) || 0;
          const updatePayload: { stock_physical: number; cost?: number; updated_at: string } = { 
            stock_physical: current + qty,
            updated_at: new Date().toISOString()
          };
          if (currentCost === 0 && xmlUnit > 0) updatePayload.cost = Math.round(xmlUnit * 100) / 100;
          const { error: prodUpdateErr } = await supabase
            .from("products")
            .update(updatePayload)
            .eq("id", productId)
            .eq("company_id", companyId);
          
          if (prodUpdateErr) { skipped++; continue; }

          // Só marca como processado se salvou estoque com sucesso
          const { error: itemUpdateErr } = await supabase
            .from("invoice_items")
            .update({
              product_id: productId,
              stock_updated: true,
              match_type: (it.match_type === "none" ? "fuzzy" : it.match_type),
            })
            .eq("id", it.id);
          
          if (!itemUpdateErr) updated++;
          else skipped++;
        }
      }

      await supabase.from("invoices").update({ status: "importada" }).eq("id", data.id);
      toast({
        title: "Reprocessamento concluído",
        description: `${created} criado(s), ${updated} atualizado(s)${skipped ? `, ${skipped} ignorado(s)` : ""}.`,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["entrada-nota-historico"] });
    } catch (e: any) {
      toast({ title: "Erro ao reprocessar", description: e.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  };

  const exportPdf = () => {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const items = (data.invoice_items as any[]) || [];
    const rows = items
      .map(
        (it) => `
        <tr>
          <td>${it.products?.name || it.xml_description}</td>
          <td>${it.products?.sku || it.xml_code || "—"}</td>
          <td style="text-align:center">${it.quantity}</td>
          <td style="text-align:right">${fmt(Number(it.unit_value))}</td>
          <td style="text-align:right">${fmt(Number(it.total_value))}</td>
        </tr>`
      )
      .join("");
    w.document.write(`
      <html><head><title>NF ${data.number}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #ddd;padding:6px}th{background:#f3f4f6;text-align:left}</style>
      </head><body>
        <h1>Nota Fiscal nº ${data.number}</h1>
        <p><b>Fornecedor:</b> ${data.issuer_name || "—"}<br/>
           <b>CNPJ:</b> ${data.issuer_cnpj || "—"}<br/>
           <b>Data:</b> ${fmtDate(data.created_at)}<br/>
           <b>Status:</b> ${data.status}</p>
        <table><thead><tr><th>Produto</th><th>SKU</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="margin-top:16px"><b>Total de itens:</b> ${data.items_count} &nbsp; | &nbsp; <b>Valor total:</b> ${fmt(Number(data.total_value))}</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Nº NF</p>
                <p className="font-semibold">{data.number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="font-semibold truncate">{data.issuer_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-semibold">{fmtDate(data.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div>{statusBadge(data.status)}</div>
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data.invoice_items as any[]) || []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-sm">{it.products?.name || it.xml_description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{it.products?.sku || it.xml_code || "—"}</TableCell>
                      <TableCell className="text-center">{it.quantity}</TableCell>
                      <TableCell className="text-right">{fmt(Number(it.unit_value))}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(it.total_value))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{data.items_count}</strong> itens
              </span>
              <span>
                Valor total: <strong className="text-primary">{fmt(Number(data.total_value))}</strong>
              </span>
            </div>
          </div>
        )}
        {!isLoading && data && pendingItems.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            ⚠️ {pendingItems.length} item(ns) desta nota ainda não estão no estoque. Clique em "Reprocessar estoque" para criar/atualizar os produtos automaticamente.
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {pendingItems.length > 0 && (
            <Button
              variant="secondary"
              onClick={reprocessar}
              disabled={reprocessing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
              {reprocessing ? "Reprocessando..." : "Reprocessar estoque"}
            </Button>
          )}
          <Button onClick={exportPdf} disabled={!data} className="gap-2">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stockAction, setStockAction] = useState<"revert" | "keep">("keep");
  const [processingMsg, setProcessingMsg] = useState("");

  const { data: invoice } = useQuery({
    queryKey: ["entrada-nota-delete-info", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", invoiceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async () => {
    if (!invoice || !companyId) return;
    setLoading(true);
    setProcessingMsg("Excluindo...");

    const timeout = setTimeout(() => {
      setProcessingMsg("Aguarde, processando...");
    }, 2000);

    try {
      const reverterEstoque = stockAction === "revert";
      const items = (invoice.invoice_items as any[]) || [];

      if (reverterEstoque) {
        // 1. Reverter estoque se solicitado
        for (const item of items) {
          if (item.product_id && item.stock_updated) {
            const { error: rpcError } = await supabase.rpc('decrementar_estoque', {
              p_product_id: item.product_id,
              p_quantidade: Math.floor(Number(item.quantity) || 0),
              p_company_id: companyId
            });
            if (rpcError) console.error("Erro ao decrementar estoque:", rpcError);
          }
        }
      }

      // 2. Deletar conferências vinculadas (se houver)
      const { data: conferences } = await supabase
        .from('conferences')
        .select('id')
        .eq('invoice_id', invoice.id);
      
      if (conferences && conferences.length > 0) {
        const confIds = conferences.map(c => c.id);
        await supabase.from('conference_items').delete().in('conference_id', confIds);
        await supabase.from('conferences').delete().eq('invoice_id', invoice.id);
      }

      // 3. Deletar pagamentos da nota (se houver)
      await supabase
        .from('invoice_payments')
        .delete()
        .eq('invoice_id', invoice.id);

      // 4. Deletar itens da nota
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);
      
      if (itemsError) throw new Error(`Erro ao deletar itens: ${itemsError.message}`);

      // 4. Deletar a nota
      const { error: invError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (invError) throw new Error(`Erro ao deletar nota: ${invError.message}`);

      toast({
        title: "Nota excluída com sucesso",
        description: reverterEstoque ? "Estoque revertido." : "Estoque mantido.",
      });

      queryClient.invalidateQueries({ queryKey: ["entrada-nota-historico"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao excluir",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setProcessingMsg("");
    }
  };

  if (!invoice) return null;

  const totalUnits = ((invoice.invoice_items as any[]) || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);

  return (
    <Dialog open={!!invoiceId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Deletar Nota Fiscal #{invoice.number}?</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm border border-border/50">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fornecedor:</span>
              <span className="font-medium">{invoice.issuer_name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">{fmtDate(invoice.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Produtos:</span>
              <span className="font-medium">{invoice.items_count} produtos · {totalUnits} unidades</span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">O que deseja fazer com os itens do estoque?</p>
            <RadioGroup value={stockAction} onValueChange={(v: any) => setStockAction(v)} className="space-y-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="revert" id="revert" className="mt-1" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="revert" className="text-sm font-medium cursor-pointer">Reverter estoque</Label>
                  <p className="text-xs text-muted-foreground">Remover as unidades que entraram com esta nota</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="keep" id="keep" className="mt-1" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="keep" className="text-sm font-medium cursor-pointer">Manter estoque</Label>
                  <p className="text-xs text-muted-foreground">Deletar só o registro da nota, manter quantidades</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md flex gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive font-medium leading-tight">
              ⚠️ Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading} className="gap-2 min-w-[140px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {processingMsg || "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
