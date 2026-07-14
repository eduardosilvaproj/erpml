import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAllProducts } from "@/hooks/useProductData";
import { ConferenceMode, ConferenceType, ScannedProduct } from "@/components/conferencia/types";
import { ConferenceStep1 } from "@/components/conferencia/ConferenceStep1";
import { ConferenceStep2 } from "@/components/conferencia/ConferenceStep2";
import { ConferenceStep3 } from "@/components/conferencia/ConferenceStep3";
import { fetchConferenceItemsGrouped } from "@/lib/conference-recovery";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "conferencia-session-v1";

const Conferencia = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const barcodeSearch = useBarcodeSearch();

  const restored = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (data.step === 1 && !data.mode && !data.conferenceName && (!data.scannedProducts || data.scannedProducts.length === 0))) return null;
      return data;
    } catch { return null; }
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(restored?.step ?? 1);
  const [mode, setMode] = useState<ConferenceMode | null>(restored?.mode ?? null);
  const [conferenceName, setConferenceName] = useState<string>(restored?.conferenceName ?? "");
  const [conferenceType, setConferenceType] = useState<ConferenceType>(restored?.conferenceType ?? "full");
  const [sectionName, setSectionName] = useState<string>(restored?.sectionName ?? "");
  const [conferenceId, setConferenceId] = useState<string | null>(restored?.conferenceId ?? null);
  const [sessionRestored, setSessionRestored] = useState(!!restored);
  const [savingSession, setSavingSession] = useState(false);
  const [loadingConference, setLoadingConference] = useState(false);
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>(
    (restored?.scannedProducts ?? []).map((p: any) => ({ ...p, lastBipAt: p.lastBipAt ? new Date(p.lastBipAt) : undefined }))
  );
  const [lastScan, setLastScan] = useState<{ success: boolean; name: string; code: string } | null>(null);

  const { data: productsData } = useAllProducts();
  const allProducts = productsData?.products ?? [];

  useEffect(() => {
    const payload = { step, mode, conferenceName, conferenceType, sectionName, conferenceId, scannedProducts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [step, mode, conferenceName, conferenceType, sectionName, conferenceId, scannedProducts]);

  const loadConferenceItems = useCallback(async (confId: string) => {
    if (!companyId) return;
    setLoadingConference(true);
    try {
      const productImagesById = new Map(allProducts.map((p) => [p.id, p.image_url ?? null] as const));
      const mapped = await fetchConferenceItemsGrouped(confId, companyId, productImagesById);
      setScannedProducts(mapped as ScannedProduct[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar itens", description: err.message, variant: "destructive" });
    } finally {
      setLoadingConference(false);
    }
  }, [allProducts, toast]);

  const handleScanResult = useCallback((result: any) => {
    const { produto, qty } = result;
    setScannedProducts(prev => {
      const existing = prev.find(p => p.productId === produto.id);
      if (existing) {
        return prev.map(p => p.productId === produto.id ? { ...p, scannedQty: p.scannedQty + qty, lastBipAt: new Date() } : p);
      }
      return [{
        productId: produto.id,
        name: produto.name,
        sku: produto.sku,
        barcode: produto.ean || produto.barcode,
        imageUrl: produto.image_url,
        scannedQty: qty,
        systemQty: produto.stock_physical,
        lastBipAt: new Date()
      }, ...prev];
    });
    setLastScan({ success: true, name: produto.name, code: barcodeSearch.lastCodigo });
  }, [barcodeSearch.lastCodigo]);

  const results = useMemo(() => {
    const ok: ScannedProduct[] = [];
    const divergent: ScannedProduct[] = [];
    const notFound: ScannedProduct[] = [];

    scannedProducts.forEach(sp => {
      if (sp.scannedQty === sp.systemQty) ok.push(sp);
      else divergent.push(sp);
    });

    allProducts.forEach(p => {
      if (p.stock_physical > 0 && !scannedProducts.find(sp => sp.productId === p.id)) {
        notFound.push({ productId: p.id, name: p.name, sku: p.sku, systemQty: p.stock_physical, scannedQty: 0, barcode: p.ean });
      }
    });

    return { ok, divergent, notFound };
  }, [scannedProducts, allProducts]);

  const reset = () => {
    setStep(1); setMode(null); setConferenceName(""); setScannedProducts([]); setConferenceId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {sessionRestored && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-primary shrink-0" />
          <span>Sessão restaurada</span>
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={reset}>Descartar</Button>
        </div>
      )}

      {step === 1 && (
        <ConferenceStep1
          mode={mode} setMode={setMode} conferenceType={conferenceType} setConferenceType={setConferenceType}
          conferenceName={conferenceName} setConferenceName={setConferenceName} sectionName={sectionName}
          setSectionName={setSectionName} onStart={() => setStep(2)}
          onContinue={async (c) => { setConferenceId(c.id); await loadConferenceItems(c.id); setStep(2); }}
        />
      )}

      {step === 2 && (
        <ConferenceStep2
          scannedProducts={scannedProducts} onAddProduct={(code) => barcodeSearch.handleSearch(code, handleScanResult)}
          onEditQty={(id, qty) => setScannedProducts(prev => prev.map(p => p.productId === id ? { ...p, scannedQty: qty } : p))}
          onFinish={() => setStep(3)} onExportCSV={() => {}} lastScan={lastScan} loading={savingSession || loadingConference}
        />
      )}

      {step === 3 && (
        <ConferenceStep3
          results={results} conferenceName={conferenceName} mode={mode} conferenceType={conferenceType}
          sectionName={sectionName} adjusting={false} onAdjustStock={async () => {}}
          onExportCSV={() => {}} onExportPDF={() => {}} onReset={reset} onBackToScan={() => setStep(2)}
        />
      )}

      <BarcodeSearchDialogs
        notFoundOpen={barcodeSearch.notFoundOpen} setNotFoundOpen={barcodeSearch.setNotFoundOpen}
        boxDetectedOpen={barcodeSearch.boxDetectedOpen} setBoxDetectedOpen={barcodeSearch.setBoxDetectedOpen}
        codigo={barcodeSearch.lastCodigo} produto={barcodeSearch.lastResult?.produto}
        boxQty={barcodeSearch.lastResult?.qty} onConfirmBox={(qty) => handleScanResult({ ...barcodeSearch.lastResult, qty })}
        onRegisterGtin={() => {}} onRegisterProduct={() => {}} onLinkProduct={() => {}}
      />
    </div>
  );
};

export default Conferencia;
