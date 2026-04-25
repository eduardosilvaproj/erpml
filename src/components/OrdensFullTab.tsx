import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Eye, Trash2, Play, Search, X, Loader2, Clock, Package, CheckCircle2, Sparkles, FileText, Upload, AlertCircle, AlertTriangle, SearchIcon, Check, Gift, ChevronDown, Boxes, Calendar, Truck, Printer, Video, Filter, ArrowUpDown } from "lucide-react";
import { SugestaoOrdemIADialog, type SugestaoItem } from "@/components/SugestaoOrdemIADialog";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { KitFormDialog } from "@/components/KitFormDialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useMyCompany, useCompanyMembers } from "@/hooks/useCompanyData";
import { useProducts } from "@/hooks/useProductData";
import {
  useOrdensFull, useCreateOrdemFull, useDeleteOrdem, useUpdateOrdemStatus, useMarcarOrdemEnviada,
  useDeleteFullOrder, ordemStatusBadge, type OrdemFull,
} from "@/hooks/useOrdensFull";
import { OrdemSeparacaoDialog } from "@/components/OrdemSeparacaoDialog";
import { OrderDetailsView } from "@/components/OrderDetailsView";
import { OrderRecordingSystem } from "@/components/OrderRecordingSystem";
import { type RecordingType } from "@/hooks/useOrderRecording";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


// Set worker src for pdfjs locally from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface NovoItem {
  product_id: string;
  name: string;
  sku: string;
  image_url: string | null;
  stock_physical: number;
  qtd: number;
}

const PrevisaoColetaCell = ({ o, onUpdate }: { o: any, onUpdate: () => void }) => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState(o.previsao_carregamento ? format(new Date(o.previsao_carregamento), "yyyy-MM-dd") : "");

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("ordens_full")
        .update({ previsao_carregamento: tempDate || null })
        .eq("id", o.id)
        .eq("company_id", companyId);
      if (error) throw error;
      
      if (o.frete_ml) {
         await supabase
          .from("full_orders")
          .update({ previsao_carregamento: tempDate || null })
          .eq("frete_ml", o.frete_ml)
          .eq("company_id", companyId);
      }
      
      toast({ title: "✅ Previsão atualizada" });
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      toast({ title: "Erro ao salvar previsão", description: err.message, variant: "destructive" });
    }
  };

  if (isEditing) {
    return (
      <Input 
        type="date" 
        className="h-8 w-32" 
        autoFocus 
        value={tempDate} 
        onChange={e => setTempDate(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
    );
  }

  return (
    <div 
      className="cursor-pointer group flex items-center gap-1"
      onClick={() => setIsEditing(true)}
    >
      {o.previsao_carregamento && !isNaN(new Date(o.previsao_carregamento).getTime()) ? (
        <>
          <span className="font-bold whitespace-nowrap">{format(new Date(o.previsao_carregamento), "dd/MM/yyyy")}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
        </>
      ) : (
        <span className="text-blue-600 text-[10px] hover:underline font-medium">+ Definir data</span>
      )}
    </div>
  );
};

const RecordingCell = ({ o, type, recordings, onUpdate }: { o: any, type: RecordingType, recordings: any[], onUpdate: () => void }) => {
  const hasRecording = recordings?.some((r: any) => r.pedido_id === o.id && r.tipo === type);

  if (!hasRecording) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
     <OrderRecordingSystem 
        pedidoId={o.id}
        defaultType={type}
        freteMl={o.frete_ml}
        orderNumber={o.numero}
        onFinished={() => onUpdate()}
        viewOnly={true}
        trigger={
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold gap-1">
            <Play className="h-3 w-3" /> Ver
          </Button>
        }
     />
  );
};


export const OrdensFullTab = () => {

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data: company } = useMyCompany();
  const { data: members } = useCompanyMembers(companyId || undefined);
  const { data: ordens, isLoading, refetch: refetchOrdens } = useOrdensFull();
  const createOrdem = useCreateOrdemFull();
  const deleteOrdem = useDeleteOrdem();
  const deleteFullOrder = useDeleteFullOrder();
  const updateStatus = useUpdateOrdemStatus();
  const marcarEnviada = useMarcarOrdemEnviada();
  const { data: fullOrders, isLoading: isLoadingFull } = useQuery({
    queryKey: ["full-orders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("full_orders")
        .select(`
          *,
          responsavel:profiles!full_orders_separado_por_fkey(full_name)
        `)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });

  const { data: allRecordings, refetch: refetchRecordings } = useQuery({
    queryKey: ["all-recordings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_recordings")
        .select("pedido_id, tipo")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });


  const [createOpen, setCreateOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [viewOrdemId, setViewOrdemId] = useState<string | null>(null);
  const [detailsOrdemId, setDetailsOrdemId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Filtros e Ordenação
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('recente');

  // PDF Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    shippingNumber: string;
    expectedProducts?: number;
    expectedUnits?: number;
    items: { ean: string; quantity: number; pdfName?: string; product?: any; error?: string }[];
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [kitFormOpen, setKitFormOpen] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState<{ ean: string; name: string } | null>(null);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrdemFull | null>(null);
  const [deleteOption, setDeleteOption] = useState<"cancel" | "delete">("cancel");
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isOpen: boolean;
    existingId: string;
    existingStatus: string;
    freteNumero: string;
  }>({
    isOpen: false,
    existingId: "",
    existingStatus: "",
    freteNumero: "",
  });
  const [fullToDeleteId, setFullToDeleteId] = useState<string | null>(null);

  const handleViewOrder = (order: any) => {
    // Status que devem abrir a nova visualização de detalhes
    const detailsStatuses = ['separada', 'aguardando_carregamento', 'concluida', 'enviado', 'carregando'];
    
    if (detailsStatuses.includes(order.status)) {
      setDetailsOrdemId(order.id);
    } else {
      setViewOrdemId(order.id);
    }
  };

  const isKit = (name?: string) => {
    if (!name) return false;
    const keywords = ['Kit', 'Combo', 'Pack', 'Conjunto'];
    return keywords.some(k => name.toLowerCase().includes(k.toLowerCase()));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF do Mercado Livre.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Melhora a extração de texto para preservar quebras de linha aproximadas
        let lastY = -1;
        let pageText = "";
        const items = textContent.items as any[];
        
        for (const item of items) {
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 2) {
            pageText += "\n";
          }
          pageText += item.str + " ";
          lastY = item.transform[5];
        }
        fullText += pageText + "\n";
      }

      console.log("Extracted PDF text:", fullText);

      // Extract Shipping Number (Frete # or Envio #)
      const shippingMatch = fullText.match(/Frete\s*#\s*(\d+)/i) || 
                          fullText.match(/Envio\s*#\s*(\d+)/i) ||
                          fullText.match(/(?:Frete|Envio|Transferência)\s*(?:#|nº)?\s*(\d{8,12})/i);
      const shippingNumber = shippingMatch ? shippingMatch[1] : "Não identificado";

      const totalProdutos = fullText.match(/Produtos do envio:\s*(\d+)/)?.[1];
      const totalUnidades = fullText.match(/Total de unidades:\s*(\d+)/)?.[1];

      // Nova lógica de parser completa e segura para Mercado Livre PDF
      const parseMercadoLivrePDF = (text: string) => {
        const blocks = text.split('SUPERMERCADO');
        const products = [];
        
        for (const block of blocks) {
          const eanMatch = block.match(/Código universal:[\s\n]*(\d{12,14})/);
          if (!eanMatch) continue;
          const ean = eanMatch[1];
          
          const skuMatch = block.match(/SKU:\s*\S+\s*\n([\s\S]+)/);
          const nomePDF = skuMatch 
            ? skuMatch[1].replace(/\n/g, ' ').replace(/Código universal/g, '').trim()
            : '';
          
          products.push({ ean, nomePDF });
        }
        
        const qtys = [...text.matchAll(/(\d+)\s*[•·]\s*A data de validade/g)]
          .map(m => parseInt(m[1]));
        
        return products.map((p, i) => ({ 
          ean: p.ean,
          sku: "",
          pdfName: p.nomePDF || "—",
          quantity: qtys[i] || 0 
        }));
      };

      const items = (await Promise.race([
        Promise.resolve(parseMercadoLivrePDF(fullText)),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: o processamento do PDF demorou mais de 10s')), 10000)
        )
      ])) as any[];

      // Validação obrigatória
      const totalUnits = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      console.log(`Parsed: ${items.length} produtos, ${totalUnits} unidades`);

      // Deduplicate by EAN and SKU
      const uniqueItems = items.reduce((acc: any[], curr: any) => {
        const existing = acc.find(i => i.ean === curr.ean);
        if (existing) {
          existing.quantity += curr.quantity; // Soma as quantidades se houver duplicatas
          if (curr.pdfName && curr.pdfName.length > (existing.pdfName?.length || 0)) {
            existing.pdfName = curr.pdfName;
          }
        } else {
          acc.push({ ...curr });
        }
        return acc;
      }, []);

      if (uniqueItems.length === 0) {
        throw new Error("Não foi possível encontrar produtos no PDF. Verifique se o arquivo é um pedido do Mercado Livre FULL.");
      }

      // Link items with products in database
      const eans = uniqueItems.map(i => i.ean);
      const skus = uniqueItems.filter(i => i.sku).map(i => i.sku as string);
      
      // First, find product IDs from alternative GTINs
      const { data: altGtins } = await supabase
        .from("product_alternative_gtins")
        .select("product_id, gtin")
        .in("gtin", eans);
      
      const altProductIds = altGtins?.map(ag => ag.product_id) || [];
      
      let orConditions = [
        `ean.in.(${eans.join(",")})`,
        `barcode.in.(${eans.join(",")})`
      ];
      if (skus.length > 0) orConditions.push(`sku.in.(${skus.join(",")})`);
      if (altProductIds.length > 0) orConditions.push(`id.in.(${altProductIds.join(",")})`);
      
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, barcode, ean, image_url, stock_physical, product_alternative_gtins(gtin)")
        .or(orConditions.join(","));

      const { data: kits } = await supabase
        .from("product_kits")
        .select("id, name, sku, ean")
        .or(`ean.in.(${eans.join(",")}),sku.in.(${eans.join(",")})`);

      const itemsWithProducts = uniqueItems.map(item => {
        let product = products?.find(p => 
          p.ean === item.ean || 
          p.barcode === item.ean || 
          (item.sku && p.sku === item.sku) ||
          (p as any).product_alternative_gtins?.some((ag: any) => ag.gtin === item.ean)
        );

        if (!product) {
          const kit = kits?.find(k => k.ean === item.ean || k.sku === item.ean);
          if (kit) {
            product = {
              ...kit,
              image_url: null, // Kits don't have images in current schema
              stock_physical: 0, // Kit stock is calculated from components
              isKit: true
            } as any;
          }
        }
        
        const isValid = item.ean.length >= 8 && item.ean.length <= 14;
        let error = !isValid ? "EAN Inválido" : undefined;
        
        if (isValid && !product) {
          error = "Código não encontrado no EAN principal nem nos GTINs alternativos. Sugerimos cadastrar como GTIN alternativo.";
        }

        return {
          ...item,
          product,
          error
        };
      });

      setParsedData({ 
        shippingNumber, 
        items: itemsWithProducts,
        expectedProducts: totalProdutos ? parseInt(totalProdutos) : undefined,
        expectedUnits: totalUnidades ? parseInt(totalUnidades) : undefined
      });
      setPreviewOpen(true);
      toast({ title: "PDF lido com sucesso!", description: `${uniqueItems.length} produtos encontrados.` });
    } catch (err: any) {
      console.error("PDF Parsing error:", err);
      toast({ title: "Erro ao ler PDF", description: err.message, variant: "destructive" });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const executeCreateOrdem = async (forcedNumero?: string) => {
    if (!parsedData) return;
    const validItems = parsedData.items.filter(i => i.product);
    const freteNumero = forcedNumero || parsedData.shippingNumber;

    try {
      // 1. Verificar duplicidade apenas dentro da mesma empresa
      const { data: existing } = await supabase
        .from('full_orders')
        .select('id, status')
        .eq('frete_ml', freteNumero)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing && !forcedNumero) {
        setDuplicateCheck({
          isOpen: true,
          existingId: existing.id,
          existingStatus: existing.status,
          freteNumero: freteNumero
        });
        return;
      }

      const newOrder = await createOrdem.mutateAsync({
        descricao: `Frete #${freteNumero}`,
        frete_ml: freteNumero,
        prazo: null,
        atribuido_para: null,
        itens: validItems.map(i => ({
          product_id: i.product.id,
          qtd_solicitada: i.quantity
        })),
        enviarParaSeparacao: true
      });

      // 2. Registrar na tabela full_orders para rastreamento (já atualizado com ordem_id no banco via hook se necessário)
      // Mas o hook useCreateOrdemFull já cria na tabela 'ordens_full'. 
      // Parece que existe uma tabela redundante 'full_orders'. 
      // O usuário quer que 'full_orders' seja usada também.
      if (companyId && freteNumero) {
        await supabase.from("full_orders").insert({
          company_id: companyId,
          frete_ml: freteNumero,
          ordem_id: (newOrder as any).ordem_id, // Usar o novo ID interno
          pdf_frete_id: freteNumero,
          status: "separacao"
        } as any);
      }

      toast({ title: "Ordem criada e enviada para separação!" });
      setPreviewOpen(false);
      setParsedData(null);
      setDuplicateCheck(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      toast({ title: "Erro ao criar ordem", description: err.message, variant: "destructive" });
    }
  };

  const confirmParsedOrder = async () => {
    if (!parsedData) return;

    const validItems = parsedData.items.filter(i => i.product);
    if (validItems.length === 0) {
      toast({ title: "Nenhum produto vinculado", description: "Vincule os produtos do PDF ao estoque antes de continuar.", variant: "destructive" });
      return;
    }

    // 1. Verificar se o frete já existe antes de criar
    try {
      const { data: existing, error } = await supabase
        .from('full_orders')
        .select('id, status')
        .eq('frete_ml', parsedData.shippingNumber)
        .order('created_at', { ascending: false }) // Pegar a mais recente
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        setDuplicateCheck({
          isOpen: true,
          existingId: existing.id,
          existingStatus: existing.status,
          freteNumero: parsedData.shippingNumber
        });
        return; // Não criar nova
      }

      await executeCreateOrdem();
    } catch (err: any) {
      toast({ title: "Erro ao verificar frete existente", description: err.message, variant: "destructive" });
    }
  };

  // Carrega a ordem em localStorage e navega para /movimentacao-full
  const handleStartSeparation = async (ordem: OrdemFull) => {
    try {
      setStartingId(ordem.id);
      const { data: itens, error } = await supabase
        .from("ordens_full_itens")
        .select("*, product:products(id, name, sku, barcode, image_url, stock_physical)")
        .eq("ordem_id", ordem.id);
      if (error) throw error;

      const produtos = (itens || [])
        .filter((it: any) => it.product)
        .map((it: any) => ({
          product_id: it.product.id,
          name: it.product.name,
          sku: it.product.sku,
          barcode: it.product.barcode,
          image_url: it.product.image_url,
          stock_physical: it.product.stock_physical,
          qtd_solicitada: it.qtd_solicitada,
        }));

      localStorage.setItem("ordem_ativa", JSON.stringify({
        id: ordem.id,
        numero: ordem.numero,
        frete_ml: ordem.frete_ml,
        descricao: ordem.descricao,
        produtos,
        autoStartRecording: true
      }));

      // Marca como em_separacao se ainda estiver aguardando
      if (ordem.status === "aguardando") {
        try { await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" }); } catch {}
      }

      toast({ title: `📋 Ordem ${ordem.numero} carregada para separação` });
      navigate("/separacao");
    } catch (e: any) {
      toast({ title: "Erro ao iniciar separação", description: e.message, variant: "destructive" });
    } finally {
      setStartingId(null);
    }
  };

  // Form state
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [atribuidoPara, setAtribuidoPara] = useState<string>("any");
  const [productSearch, setProductSearch] = useState("");
  const [novosItens, setNovosItens] = useState<NovoItem[]>([]);
  const [qtdInput, setQtdInput] = useState("1");

  const { data: searchResults } = useProducts({
    search: productSearch || undefined,
    page: 1,
    pageSize: 8,
    sortBy: "name",
    sortOrder: "asc",
  });

  // Detect role
  const myMember = members?.find((m) => m.user_id === user?.id);
  const isOwner = company?.owner_id === user?.id;
  const isManager = myMember?.role === "manager";
  const canManageOrders = isOwner || isManager;

  const myOrders = useMemo(() => {
    if (!ordens || !user) return [];
    return ordens.filter((o) => o.atribuido_para === user.id || o.atribuido_para === null);
  }, [ordens, user]);

  // Cards summary
  const summary = useMemo(() => {
    const list = ordens || [];
    const today = new Date().toDateString();
    return {
      abertas: list.filter((o) => o.status !== "concluida" && o.status !== "cancelada" && o.status !== "enviado").length,
      aguardando: list.filter((o) => o.status === "aguardando").length,
      em_separacao: list.filter((o) => o.status === "em_separacao").length,
      concluidas_hoje: list.filter((o) => (o.status === "concluida" || o.status === "enviado") && o.concluida_em && new Date(o.concluida_em).toDateString() === today).length,
    };
  }, [ordens]);

  const ordensFiltradas = useMemo(() => {
    if (!ordens) return [];
    let list = [...ordens];

    // Status Filter
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'abertas') {
        list = list.filter(o => o.status !== 'concluida' && o.status !== 'cancelada' && o.status !== 'enviado');
      } else if (filtroStatus === 'concluidas_hoje') {
        const today = new Date().toDateString();
        list = list.filter(o => (o.status === 'concluida' || o.status === 'enviado') && o.concluida_em && new Date(o.concluida_em).toDateString() === today);
      } else if (filtroStatus === 'enviado') {
        list = list.filter(o => o.status === 'enviado' || o.status === 'concluida');
      } else {
        list = list.filter(o => o.status === filtroStatus);
      }
    }

    // Search Filter
    if (busca) {
      list = list.filter(o => 
        (o.frete_ml && o.frete_ml.toLowerCase().includes(busca.toLowerCase())) ||
        (o.numero && o.numero.toLowerCase().includes(busca.toLowerCase())) ||
        (o.descricao && o.descricao.toLowerCase().includes(busca.toLowerCase()))
      );
    }

    // Sorting
    list.sort((a, b) => {
      switch (ordenacao) {
        case 'antigo':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'previsao':
          if (!a.previsao_carregamento) return 1;
          if (!b.previsao_carregamento) return -1;
          return new Date(a.previsao_carregamento).getTime() - new Date(b.previsao_carregamento).getTime();
        case 'quantidade':
          return (b.total_itens || 0) - (a.total_itens || 0);
        case 'recente':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return list;
  }, [ordens, filtroStatus, busca, ordenacao]);

  const resetForm = () => {
    setDescricao(""); setPrazo(""); setAtribuidoPara("any");
    setNovosItens([]); setProductSearch(""); setQtdInput("1");
  };

  const addProduct = (p: any) => {
    const qtd = parseInt(qtdInput) || 1;
    if (novosItens.find((i) => i.product_id === p.id)) {
      toast({ title: "Produto já adicionado", variant: "destructive" });
      return;
    }
    setNovosItens([...novosItens, {
      product_id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      stock_physical: p.stock_physical, qtd,
    }]);
    setProductSearch(""); setQtdInput("1");
  };

  const removeItem = (id: string) => setNovosItens(novosItens.filter((i) => i.product_id !== id));

  const handleSave = async (enviar: boolean) => {
    if (!descricao.trim()) {
      toast({ title: "Informe um nome/descrição", variant: "destructive" });
      return;
    }
    if (novosItens.length === 0) {
      toast({ title: "Adicione ao menos um produto", variant: "destructive" });
      return;
    }
    try {
      await createOrdem.mutateAsync({
        descricao: descricao.trim(),
        prazo: prazo || null,
        atribuido_para: atribuidoPara === "any" ? null : atribuidoPara,
        itens: novosItens.map((i) => ({ product_id: i.product_id, qtd_solicitada: i.qtd })),
        enviarParaSeparacao: enviar,
      });
      toast({ title: enviar ? "Ordem enviada para separação" : "Rascunho salvo" });
      setCreateOpen(false); resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao criar ordem", description: e.message, variant: "destructive" });
    }
  };

  const handleCancel = async (o: OrdemFull) => {
    setOrderToDelete(o);
    setDeleteOption("cancel");
    setDeleteDialogOpen(true);
  };

  const handleDelete = async (o: OrdemFull) => {
    setOrderToDelete(o);
    setDeleteOption("delete");
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      if (deleteOption === "cancel") {
        await updateStatus.mutateAsync({ id: orderToDelete.id, status: "cancelada" });
        toast({ title: "Ordem cancelada com sucesso" });
      } else {
        // Excluir permanentemente usando o hook que já remove em cascata
        await deleteOrdem.mutateAsync({ 
          id: orderToDelete.id, 
          frete_ml: orderToDelete.frete_ml 
        });

        toast({ title: "✅ Ordem e todos os registros vinculados removidos 100%" });
        refetchOrdens();
        refetchRecordings();
      }
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (err: any) {
      toast({ title: "Erro na operação", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManualLink = (idx: number, product: any) => {
    if (!parsedData) return;
    const newItems = [...parsedData.items];
    newItems[idx] = { ...newItems[idx], product };
    setParsedData({ ...parsedData, items: newItems });
    setEditingItemIdx(null);
    toast({ title: "Produto vinculado manualmente!" });
  };

  const handleOpenExisting = () => {
    const existingOrder = ordens?.find(o => o.frete_ml === duplicateCheck.freteNumero || o.numero === duplicateCheck.freteNumero);
    if (existingOrder) {
      handleViewOrder(existingOrder);
    } else {
      toast({ title: "Ordem não encontrada na lista", variant: "destructive" });
    }
    setDuplicateCheck(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="space-y-6">
      {/* ETAPA 1 — Carregar Pedido ML */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">📄 Carregar PDF do Mercado Livre</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                ETAPA 1 — Arraste o PDF do pedido ou clique no botão abaixo para selecionar. 
                O sistema identificará os produtos e quantidades automaticamente.
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            <Button 
              size="lg" 
              className="px-8 gap-2 h-12 text-base font-semibold shadow-lg shadow-primary/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Lendo PDF...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Selecionar PDF Mercado Livre
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog do PDF */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b bg-muted/30">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Preview da Ordem</DialogTitle>
              <div className="mt-2 space-y-1">
                <p className="text-xl font-semibold text-primary">
                  Frete #{parsedData?.shippingNumber}
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  {parsedData?.expectedProducts || parsedData?.items.length} produtos · {parsedData?.expectedUnits || parsedData?.items.reduce((acc, curr) => acc + curr.quantity, 0)} unidades
                </p>
                {parsedData && parsedData.expectedProducts && parsedData.expectedProducts > parsedData.items.length && (
                  <p className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    ⚠️ Parser encontrou {parsedData.items.length}/{parsedData.expectedProducts} produtos
                  </p>
                )}
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-bold text-foreground">EAN</TableHead>
                  <TableHead className="font-bold text-foreground">Nome no PDF (ML)</TableHead>
                  <TableHead className="font-bold text-foreground">Nome no Sistema</TableHead>
                  <TableHead className="font-bold text-foreground text-center">QTD</TableHead>
                  <TableHead className="font-bold text-foreground">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData?.items.map((item, idx) => (
                  <TableRow 
                    key={idx} 
                    className={`transition-colors cursor-pointer group ${
                      !item.product ? "bg-amber-500/5 hover:bg-amber-500/10" : "bg-emerald-500/5 hover:bg-emerald-500/10"
                    }`}
                    onClick={() => {
                      if (!item.product) {
                        setEditingItemIdx(idx);
                        setProductSearch(item.ean);
                      }
                    }}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.ean}</TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="text-sm font-medium line-clamp-2" title={item.pdfName}>
                        {item.pdfName}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.product ? (
                        <div className="flex items-center gap-2">
                          {item.product.image_url ? (
                            <img src={item.product.image_url} alt="" className="h-6 w-6 rounded object-cover border" />
                          ) : (
                            <div className="h-6 w-6 rounded border flex items-center justify-center bg-muted">
                              {(item.product as any).isKit ? <Gift className="h-3 w-3 text-primary" /> : <Package className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          )}
                          <span className="text-sm font-semibold">{item.product.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <span className="text-muted-foreground/50">—</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-7 text-[10px] w-fit px-2 gap-1 ${isKit(item.pdfName) ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isKit(item.pdfName) ? <Gift className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                {isKit(item.pdfName) ? "🎁 Cadastrar Kit" : "➕ Cadastrar"}
                                <ChevronDown className="h-3 w-3 ml-0.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingItemIdx(idx);
                                setSelectedProductData({ ean: item.ean, name: item.pdfName || "" });
                                setProductFormOpen(true);
                              }}>
                                <Package className="h-4 w-4 mr-2" /> Cadastrar como Produto
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingItemIdx(idx);
                                setSelectedProductData({ ean: item.ean, name: item.pdfName || "" });
                                setKitFormOpen(true);
                              }}>
                                <Gift className="h-4 w-4 mr-2" /> Cadastrar como Kit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-base">{item.quantity}</TableCell>
                    <TableCell>
                      {item.error ? (
                        <div className="flex items-start gap-1 text-destructive font-bold text-xs max-w-[150px]">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="leading-tight">{item.error}</span>
                        </div>
                      ) : item.product ? (
                        <div className="flex items-center gap-1 text-emerald-600 font-bold whitespace-nowrap text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>✅ Vinculado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500 font-bold whitespace-nowrap text-xs">
                          {isKit(item.pdfName) ? (
                            <>
                              <Gift className="h-3 w-3" />
                              <span>🎁 Sugestão: Kit</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              <span>⚠️ Não encontrado</span>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {editingItemIdx !== null && (
              <div className="mt-4 p-4 border rounded-lg bg-background shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <SearchIcon className="h-4 w-4" /> Vincular manualmente: {parsedData?.items[editingItemIdx].pdfName}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setEditingItemIdx(null)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Pesquisar por nome ou SKU..." 
                      className="pl-10"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                    {searchResults?.products.map((p: any) => (
                      <button
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted border border-transparent hover:border-border transition-colors text-left"
                        onClick={() => handleManualLink(editingItemIdx, p)}
                      >
                        <div className="flex items-center gap-3">
                          {p.image_url && <img src={p.image_url} className="h-8 w-8 rounded object-cover" />}
                          <div>
                            <p className="text-xs font-bold line-clamp-1">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">EAN/SKU: {p.ean || p.sku}</p>
                          </div>
                        </div>
                        <Check className="h-4 w-4 text-emerald-500" />
                      </button>
                    ))}
                    {productSearch && searchResults?.products.length === 0 && (
                      <p className="text-center py-4 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1">
                ✅ {parsedData?.items.filter(i => i.product).length} vinculados automaticamente
              </span>
              <span className="text-amber-600 bg-amber-500/10 px-2 py-1 rounded flex items-center gap-1">
                ⚠️ {parsedData?.items.filter(i => !i.product).length} não encontrados
              </span>
              <span className="text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                📦 {parsedData?.items.reduce((acc, curr) => acc + curr.quantity, 0)} unidades total
              </span>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="gap-2 h-11 flex-1 sm:flex-none border-amber-200 hover:bg-amber-50 text-amber-700"
                onClick={() => setPreviewOpen(false)}
              >
                Corrigir vínculos
              </Button>
              <Button 
                className="gap-2 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-500/20 flex-1 sm:flex-none" 
                onClick={confirmParsedOrder}
                disabled={createOrdem.isPending || !parsedData?.items.some(i => i.product)}
              >
                {createOrdem.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Confirmar e iniciar separação →
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductFormDialog 
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        product={selectedProductData ? { ean: selectedProductData.ean, name: selectedProductData.name } as any : null}
        onSuccess={(registered) => {
          if (editingItemIdx !== null) {
            handleManualLink(editingItemIdx, registered);
          }
        }}
      />
      
      <KitFormDialog
        open={kitFormOpen}
        onOpenChange={setKitFormOpen}
        initialData={selectedProductData ? { ean: selectedProductData.ean, name: selectedProductData.name } : undefined}
        onSuccess={(registered) => {
          if (editingItemIdx !== null) {
            handleManualLink(editingItemIdx, { ...registered, isKit: true });
          }
        }}
      />
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard 
          icon={ClipboardList} 
          label="Ordens abertas" 
          value={summary.abertas} 
          color="text-primary" 
          onClick={() => setFiltroStatus(filtroStatus === 'abertas' ? 'todos' : 'abertas')}
          isSelected={filtroStatus === 'abertas'}
        />
        <SummaryCard 
          icon={Clock} 
          label="Aguardando" 
          value={summary.aguardando} 
          color="text-yellow-500" 
          onClick={() => setFiltroStatus(filtroStatus === 'aguardando' ? 'todos' : 'aguardando')}
          isSelected={filtroStatus === 'aguardando'}
        />
        <SummaryCard 
          icon={Package} 
          label="Em separação" 
          value={summary.em_separacao} 
          color="text-blue-500" 
          onClick={() => setFiltroStatus(filtroStatus === 'em_separacao' ? 'todos' : 'em_separacao')}
          isSelected={filtroStatus === 'em_separacao'}
        />
        <SummaryCard 
          icon={CheckCircle2} 
          label="Concluídas hoje" 
          value={summary.concluidas_hoje} 
          color="text-emerald-500" 
          onClick={() => setFiltroStatus(filtroStatus === 'concluidas_hoje' ? 'todos' : 'concluidas_hoje')}
          isSelected={filtroStatus === 'concluidas_hoje'}
        />
      </div>

      {/* Painel funcionário (ordens atribuídas) */}
      {!canManageOrders && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Ordens para separar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myOrders.filter((o) => o.status === "aguardando" || o.status === "em_separacao").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ordem atribuída a você</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myOrders.filter((o) => o.status === "aguardando" || o.status === "em_separacao").map((o) => (
                  <Card key={o.id} className="border-primary/20">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{o.numero}</span>
                        <Badge variant="outline" className={ordemStatusBadge(o.status).cls}>{ordemStatusBadge(o.status).label}</Badge>
                      </div>
                      <p className="font-medium text-sm line-clamp-2">{o.descricao || "Sem descrição"}</p>
                      <div className="text-xs text-muted-foreground">
                        {o.total_produtos} produtos • {o.total_itens} unidades
                        {o.prazo && <> • Prazo {new Date(o.prazo).toLocaleDateString("pt-BR")}</>}
                      </div>
                      <Button size="sm" className="w-full" disabled={startingId === o.id} onClick={() => handleStartSeparation(o)}>
                        <Play className="h-3 w-3 mr-1" /> {startingId === o.id ? "Carregando..." : "Iniciar separação"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista geral (Gestor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Ordens de Envio FULL
          </CardTitle>
          {canManageOrders && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSummaryOpen(true)} className="gap-2">
                <ClipboardList className="h-4 w-4" /> Ver resumo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIaOpen(true)}
                className="border-purple-500/40 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20">
                <Sparkles className="h-4 w-4 mr-1 text-purple-400" /> Sugestão IA
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova ordem
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por frete..." 
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando">📄 PDF Carregado</SelectItem>
                <SelectItem value="em_separacao">🔄 Em Separação</SelectItem>
                <SelectItem value="separada">✅ Separado</SelectItem>
                <SelectItem value="aguardando_carregamento">🚛 Aguardando Coleta</SelectItem>
                <SelectItem value="enviado">📦 Enviado</SelectItem>
                <SelectItem value="cancelada">❌ Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-[200px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recente">Mais recente primeiro</SelectItem>
                <SelectItem value="antigo">Mais antigo primeiro</SelectItem>
                <SelectItem value="previsao">Previsão de coleta</SelectItem>
                <SelectItem value="quantidade">Maior quantidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : ordensFiltradas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma ordem encontrada com os filtros selecionados</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Produtos</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Previsão Coleta</TableHead>
                    <TableHead className="hidden md:table-cell">🎥 Grav. Sep.</TableHead>
                    <TableHead className="hidden md:table-cell">🚛 Grav. Carreg.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordensFiltradas.map((o) => {
                    const responsavel = members?.find((m) => m.user_id === o.atribuido_para);
                    const podeExecutar = (o.atribuido_para === user?.id || o.atribuido_para === null) && (o.status === "aguardando" || o.status === "em_separacao");
                    const sb = ordemStatusBadge(o.status);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-[10px] whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{(o as any).ordem_id || o.numero}</span>
                            {o.separado_em && <span className="text-[10px] text-emerald-600 font-bold">Separado ✅</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">Frete #{o.frete_ml || "—"}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{o.descricao || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-center">{o.total_produtos}</TableCell>
                        <TableCell className="text-center">{o.total_itens}</TableCell>
                        <TableCell className="text-xs">
                          {o.separado_por_profile ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-emerald-600">{o.separado_por_profile.full_name}</span>
                              <span className="text-[10px] text-muted-foreground">Executado</span>
                            </div>
                          ) : o.atribuido ? (
                            <div className="flex flex-col">
                              <span>{o.atribuido.full_name}</span>
                              <span className="text-[10px] text-muted-foreground">Atribuído</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Qualquer</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <PrevisaoColetaCell o={o} onUpdate={() => {
                            refetchOrdens();
                            refetchRecordings();
                          }} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <RecordingCell o={o} type="separacao" recordings={allRecordings || []} onUpdate={refetchRecordings} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <RecordingCell o={o} type="carregamento" recordings={allRecordings || []} onUpdate={refetchRecordings} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${sb.cls} gap-1 text-[10px] px-1.5`}>
                            {sb.label}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            {podeExecutar && (
                              <Button size="sm" variant="default" disabled={startingId === o.id} onClick={() => handleStartSeparation(o)}>
                                <Play className="h-3 w-3 mr-1" /> {startingId === o.id ? "..." : "Executar"}
                              </Button>
                            )}
                            
                            {(o.status === 'aguardando_carregamento' || o.status === 'separada' || o.status === 'carregando') ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-2">
                                    Ações <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuItem onClick={() => handleViewOrder(o)}>
                                    <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewOrder(o)}>
                                    <Calendar className="h-4 w-4 mr-2" /> Editar previsão de coleta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewOrder(o)}>
                                    <Truck className="h-4 w-4 mr-2" /> Iniciar carregamento
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => window.print()}>
                                    <Printer className="h-4 w-4 mr-2" /> Imprimir relatório
                                  </DropdownMenuItem>
                                  {canManageOrders && (
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleCancel(o)}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Excluir/Cancelar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button size="icon" variant="ghost" title="Ver" onClick={() => handleViewOrder(o)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canManageOrders && (o.status !== 'aguardando_carregamento' && o.status !== 'separada' && o.status !== 'carregando') && (
                              <Button size="icon" variant="ghost" title="Excluir/Cancelar" className="text-destructive" onClick={() => handleCancel(o)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Ordem */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Envio FULL</DialogTitle>
            <DialogDescription>Crie uma ordem de separação para o estoque FULL.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome / descrição da ordem *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Envio semanal — Semana 16" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Atribuir a</Label>
                <Select value={atribuidoPara} onValueChange={setAtribuidoPara}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer funcionário</SelectItem>
                    {members?.filter((m) => m.is_active).map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.user_id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Buscar e adicionar produtos</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Nome ou SKU..." />
                </div>
                <Input type="number" min={1} value={qtdInput} onChange={(e) => setQtdInput(e.target.value)} className="w-20" placeholder="Qtd" />
              </div>
              {productSearch && searchResults?.products && searchResults.products.length > 0 && (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {searchResults.products.map((p) => (
                    <button key={p.id} type="button" onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left text-sm border-b border-border/50 last:border-b-0">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku} • Estoque físico: {p.stock_physical}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {novosItens.length > 0 && (
              <div className="border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center w-24">Qtd</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novosItens.map((i) => (
                      <TableRow key={i.product_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i.image_url ? <img src={i.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                            <div>
                              <p className="text-sm">{i.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{i.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{i.stock_physical}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" min={1} value={i.qtd} onChange={(e) => {
                            const q = parseInt(e.target.value) || 1;
                            setNovosItens(novosItens.map((it) => it.product_id === i.product_id ? { ...it, qtd: q } : it));
                          }} className="w-16 mx-auto h-8 text-center" />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i.product_id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-2 border-t border-border bg-secondary/20 text-xs text-muted-foreground text-right">
                  {novosItens.length} produtos • {novosItens.reduce((s, i) => s + i.qtd, 0)} unidades totais
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={createOrdem.isPending}>
              Salvar rascunho
            </Button>
            <Button onClick={() => handleSave(true)} disabled={createOrdem.isPending}>
              {createOrdem.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enviar para separação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sugestão IA */}
      <SugestaoOrdemIADialog
        open={iaOpen}
        onOpenChange={setIaOpen}
        onApply={(items: SugestaoItem[]) => {
          setNovosItens(items.map((s) => ({
            product_id: s.id, name: s.name, sku: s.sku, image_url: s.image_url,
            stock_physical: s.stock_physical, qtd: s.qtd_sugerida,
          })));
          setDescricao(`Envio sugerido pela IA — ${new Date().toLocaleDateString("pt-BR")}`);
          setCreateOpen(true);
        }}
      />

      {/* Visualização de Bipagem/Separação */}
      <OrdemSeparacaoDialog
        ordemId={viewOrdemId}
        onClose={() => setViewOrdemId(null)}
      />

      {/* Visualização de Detalhes e Gravação */}
      <OrderDetailsView
        ordemId={detailsOrdemId}
        onClose={() => setDetailsOrdemId(null)}
      />

      {/* Resumo Full Orders */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo de Pedidos Full</DialogTitle>
            <DialogDescription>
              Status atual e progresso das ordens integradas com o Mercado Livre Full.
            </DialogDescription>
          </DialogHeader>

          {isLoadingFull ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (fullOrders || []).length === 0 ? (
            <div className="text-center p-12 bg-muted/20 rounded-lg border-2 border-dashed">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum registro de pedido full encontrado.</p>
              <p className="text-xs text-muted-foreground mt-1">Carregue um PDF para iniciar o rastreamento.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PDF Frete ID</TableHead>
                  <TableHead>Status Atual</TableHead>
                  <TableHead>Progresso (Bipagem)</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fullOrders?.map((fo) => {
                  const matchingOrder = ordens?.find(o => o.frete_ml === fo.frete_ml || o.descricao?.includes(fo.pdf_frete_id || ""));
                  const progress = matchingOrder ? (matchingOrder.total_itens_separados / (matchingOrder.total_itens || 1)) * 100 : 0;
                  
                  return (
                    <TableRow key={fo.id}>
                      <TableCell className="font-mono font-bold text-primary">
                        <div className="flex flex-col">
                          <span>#{fo.frete_ml || fo.pdf_frete_id || "—"}</span>
                          {fo.previsao_carregamento && (
                            <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {format(new Date(fo.previsao_carregamento), "dd/MM HH:mm")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={
                            fo.status === 'enviado' ? 'bg-emerald-500 text-white border-emerald-200' :
                            fo.status === 'aguardando_carregamento' ? 'bg-purple-100 text-purple-700 border-purple-200 font-bold' :
                            fo.status === 'separando' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }>
                            {fo.status === 'aguardando_carregamento' ? '🚛 Aguardando Carregamento' : 
                             fo.status === 'separando' ? '📦 Separando' :
                             fo.status === 'pdf_carregado' ? '📄 PDF Lido' :
                             fo.status}
                          </Badge>
                          {fo.separado_em && (
                            <span className="text-[10px] text-emerald-600 font-medium">Separado ✅</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {matchingOrder ? (
                          <div className="space-y-1 w-[150px]">
                            <div className="flex justify-between text-[10px] font-medium">
                              <span>{matchingOrder.total_itens_separados} / {matchingOrder.total_itens} un.</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Ordem não vinculada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(fo as any).responsavel?.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(fo.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {matchingOrder && progress === 100 && fo.status !== 'enviado' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="bg-emerald-600 hover:bg-emerald-700 h-8 gap-1 shadow-sm"
                              onClick={async () => {
                                try {
                                  await marcarEnviada.mutateAsync(matchingOrder.id);
                                  toast({ title: "Ordem marcada como enviada!" });
                                } catch (err: any) {
                                  toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
                                }
                              }}
                              disabled={marcarEnviada.isPending}
                            >
                              {marcarEnviada.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Marcar Enviado
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => {
                            if (matchingOrder) handleViewOrder(matchingOrder);
                            else toast({ title: "Ordem correspondente não encontrada", variant: "destructive" });
                          }}>
                            Ver Detalhes
                          </Button>
                          {canManageOrders && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => setFullToDeleteId(fo.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> ⚠️ Cancelar/Excluir esta ordem?
            </DialogTitle>
            <DialogDescription className="py-2">
              <div className="bg-muted p-3 rounded-md text-foreground font-medium mb-4">
                Frete #{orderToDelete?.frete_ml || orderToDelete?.numero} — {orderToDelete?.total_produtos} produtos · {orderToDelete?.total_itens} unidades
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                <input 
                  type="radio" 
                  name="deleteOption" 
                  checked={deleteOption === "cancel"} 
                  onChange={() => setDeleteOption("cancel")}
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Cancelar ordem</span>
                  <span className="text-xs text-muted-foreground">Mantém no histórico como 'Cancelada'</span>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:bg-destructive/5 has-[:checked]:border-destructive">
                <input 
                  type="radio" 
                  name="deleteOption" 
                  checked={deleteOption === "delete"} 
                  onChange={() => setDeleteOption("delete")}
                  className="w-4 h-4 text-destructive focus:ring-destructive"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-destructive">Excluir permanentemente</span>
                  <span className="text-xs text-muted-foreground">Remove todos os dados da base de dados</span>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Voltar</Button>
            <Button 
              variant={deleteOption === "delete" ? "destructive" : "default"} 
              onClick={confirmDeleteAction}
              disabled={isDeleting}
              className="px-8"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Frete Existente */}
      <Dialog open={duplicateCheck.isOpen} onOpenChange={(open) => setDuplicateCheck(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] text-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-6xl mb-2">⚠️</div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Duplicidade Detectada</DialogTitle>
              <DialogDescription className="text-base text-center pt-2">
                Sua empresa já tem este frete como <span className="font-bold text-primary">"{duplicateCheck.existingStatus}"</span>.
              </DialogDescription>
            </DialogHeader>
            <p className="text-muted-foreground pt-2">Deseja continuar de onde parou?</p>
            
            <div className="flex flex-col w-full gap-3 pt-4">
              <Button onClick={handleOpenExisting} className="w-full py-6 text-base gap-2">
                ▶ Continuar ordem existente
              </Button>
              <Button variant="outline" onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))} className="w-full py-6 text-base gap-2">
                ❌ Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullToDeleteId} onOpenChange={(o) => !o && setFullToDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px] text-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-6xl mb-2 text-destructive">🗑️</div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Excluir registro?</DialogTitle>
              <DialogDescription className="text-base text-center pt-2">
                Deseja excluir o registro de rastreamento deste pedido FULL? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col w-full gap-3 pt-4">
              <Button 
                variant="destructive" 
                className="w-full py-6 text-base gap-2"
                onClick={async () => {
                  if (!fullToDeleteId) return;
                  try {
                    await deleteFullOrder.mutateAsync(fullToDeleteId);
                    toast({ title: "Registro excluído" });
                    setFullToDeleteId(null);
                  } catch (err: any) {
                    toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
                  }
                }}
              >
                ❌ Sim, excluir agora
              </Button>
              <Button variant="outline" onClick={() => setFullToDeleteId(null)} className="w-full py-6 text-base gap-2">
                Voltar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color, onClick, isSelected }: any) => (
  <Card 
    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
    onClick={onClick}
  >
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);
