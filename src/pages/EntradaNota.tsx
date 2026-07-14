import React, { useCallback, useRef, useMemo } from "react";
import { Bot, Loader2, CheckCircle, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { parseNFeXml, matchProducts, type NFeData, type MatchResult } from "@/lib/nfe-parser";
import { EntradaNotaHistorico } from "@/components/EntradaNotaHistorico";

import { WizardProgress } from "@/features/entrada-nota/components/WizardProgress";
import { RestoreDialog } from "@/features/entrada-nota/components/RestoreDialog";
import { StepNF } from "@/features/entrada-nota/components/StepNF";
import { StepConferencia } from "@/features/entrada-nota/components/StepConferencia";
import { StepDivergencias } from "@/features/entrada-nota/components/StepDivergencias";
import { StepAjustes } from "@/features/entrada-nota/components/StepAjustes";
import { StepConfirmar } from "@/features/entrada-nota/components/StepConfirmar";
import { BatchNfeList } from "@/features/entrada-nota/components/BatchNfeList";

import { useEntradaNotaState } from "@/features/entrada-nota/hooks/useEntradaNotaState";
import { useEntradaNotaPersistence } from "@/features/entrada-nota/hooks/useEntradaNotaPersistence";
import { useConferenceBip } from "@/features/entrada-nota/hooks/useConferenceBip";
import { useEntradaNotaConfirm } from "@/features/entrada-nota/hooks/useEntradaNotaConfirm";
import { type ConferenceItem, type WizardStep } from "@/features/entrada-nota/types";

const STEP_LABELS = ["NF", "Conferência", "Divergências", "Ajustes XML", "Confirmar"];

const EntradaNota = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const barcodeSearch = useBarcodeSearch();
  const bipRef = useRef<BarcodeScannerInputHandle>(null);

  const state = useEntradaNotaState();
  const {
    currentStep, setCurrentStep,
    completedSteps, setCompletedSteps,
    nfMode, setNfMode,
    nfNumber, setNfNumber,
    nfSeries, setNfSeries,
    nfFornecedor, setNfFornecedor,
    nfDate, setNfDate,
    loading, setLoading,
    nfeData, setNfeData,
    nfeChave, setNfeChave,
    matches, setMatches,
    batchNfes, setBatchNfes,
    sefazEntries, setSefazEntries,
    batchSearchProgress, setBatchSearchProgress,
    dragOver, setDragOver,
    conferenceItems, setConferenceItems,
    bipInput, setBipInput,
    bipAlert, setBipAlert,
    flashIdx, setFlashIdx,
    batchConferenceMode, setBatchConferenceMode,
    currentBatchNfIdx, setCurrentBatchNfIdx,
    unknownGtinDialog, setUnknownGtinDialog,
    unknownGtinProduct, setUnknownGtinProduct,
    unknownGtinQty, setUnknownGtinQty,
    unknownGtinBoxes, setUnknownGtinBoxes,
    unknownGtinSave, setUnknownGtinSave,
    divergences, setDivergences,
    divergenceActions, setDivergenceActions,
    adjustedItems, setAdjustedItems,
    newProductDialog, setNewProductDialog,
    setNewProductData,
    entryNotes, setEntryNotes,
    saving, setSaving,
    done, setDone,
    autoUpdateStock, setAutoUpdateStock,
    autoUpdateCost, setAutoUpdateCost,
    batchSelectedForConfirm, setBatchSelectedForConfirm,
    batchConfirmResult, setBatchConfirmResult
  } = state;

  const persistence = useEntradaNotaPersistence(
    {
      currentStep, completedSteps, conferenceItems, batchNfes, batchConferenceMode, 
      currentBatchNfIdx, divergences, divergenceActions, adjustedItems, entryNotes, 
      autoUpdateStock, autoUpdateCost, done, nfMode, nfeChave, kitGroups: state.kitGroups
    },
    state
  );

  const bipHook = useConferenceBip(
    conferenceItems, setConferenceItems, bipRef, barcodeSearch, setBipInput, 
    setBipAlert, setFlashIdx, state.setBoxBipDialog
  );

  const confirmHook = useEntradaNotaConfirm(
    companyId, queryClient, toast,
    { 
      nfeData, matches, adjustedItems, autoUpdateStock, autoUpdateCost, 
      isBatchMode: batchNfes.length > 1, selectedBatchNfes: batchNfes.filter(n => n.selected), 
      batchSelectedForConfirm, kitGroups: state.kitGroups
    },
    setSaving, setDone, setBatchConfirmResult, persistence.clearPersistedState
  );

  const isBatchMode = batchNfes.length > 1;
  const selectedBatchNfes = useMemo(() => batchNfes.filter((n) => n.selected), [batchNfes]);
  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeDigits = (value: string) => value.replace(/\D/g, "");

  const fetchProductsForMatching = useCallback(async () => {
    if (!companyId) return [];
    const { data, error } = await supabase
      .from("products")
      .select("id, name, barcode, ean, sku, gtin_cx, box_quantity, product_alternative_gtins(gtin)")
      .eq("company_id", companyId as string)
      .order("name");
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return data || [];
  }, [companyId]);

  const handleBatchXmlUpload = useCallback(async (files: FileList | File[]) => {
    const xmlFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (xmlFiles.length === 0) return;
    setLoading(true);
    try {
      const dbProducts = await fetchProductsForMatching();
      for (const file of xmlFiles) {
        try {
          const xml = await file.text();
          const parsed = parseNFeXml(xml);
          const matched = matchProducts(parsed.products, dbProducts);
          setBatchNfes((prev) => [...prev, { id: generateId(), nfeData: parsed, matches: matched, fileName: file.name, selected: true, conferenceStatus: "pending" }]);
        } catch (err: any) { toast({ title: `Erro: ${file.name}`, description: err.message, variant: "destructive" }); }
      }
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); } finally { setLoading(false); }
  }, [fetchProductsForMatching, toast, setBatchNfes, setLoading]);

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return batchNfes.length > 0 && (isBatchMode ? selectedBatchNfes.length > 0 : batchNfes[0]?.matches?.length > 0);
    if (step === 3 || step === 4) return completedSteps.has(2);
    if (step === 5) return completedSteps.has(4) || completedSteps.has(3);
    return false;
  };

  const loadNfConference = (idx: number) => {
    const nf = selectedBatchNfes[idx];
    if (!nf) return;
    setConferenceItems(nf.matches.map((m) => ({
      xmlProduct: m.xmlProduct, matchedProductId: m.matchedProductId, matchedProductName: m.matchedProductName,
      matchedProductBarcode: m.matchedProductBarcode, matchedProductSku: m.matchedProductSku, matchedProductGtinCx: null,
      matchedProductBoxQty: null, matchType: m.matchType, expectedQty: Math.floor(m.xmlProduct.quantity), scannedQty: 0,
      status: "pending", nfNumber: nf.nfeData.number,
    })));
    setCurrentBatchNfIdx(idx);
  };

  const goToStep = (step: WizardStep) => {
    if (step === 2) {
      if (isBatchMode && selectedBatchNfes.length > 0) {
        setBatchConferenceMode(null);
        setCompletedSteps((p) => new Set([...p, 1]));
      } else if (batchNfes.length === 1) {
        const singleNf = batchNfes[0];
        setConferenceItems(singleNf.matches.map((m) => ({
          xmlProduct: m.xmlProduct, matchedProductId: m.matchedProductId, matchedProductName: m.matchedProductName,
          matchedProductBarcode: m.matchedProductBarcode, matchedProductSku: m.matchedProductSku, matchedProductGtinCx: null,
          matchedProductBoxQty: null, matchType: m.matchType, expectedQty: Math.floor(m.xmlProduct.quantity), scannedQty: 0, status: "pending",
        })));
        setNfeData(singleNf.nfeData);
        setMatches(singleNf.matches);
        setCompletedSteps((p) => new Set([...p, 1]));
      }
    }
    if (step === 3) {
      setDivergences(conferenceItems.filter((i) => i.status !== "ok"));
      setDivergenceActions({});
      setCompletedSteps((p) => new Set([...p, 2]));
    }
    if (step === 4) {
      setAdjustedItems(isBatchMode ? selectedBatchNfes.flatMap((n) => n.matches) : [...matches]);
      setCompletedSteps((p) => new Set([...p, 3]));
    }
    if (step === 5) {
      setCompletedSteps((p) => new Set([...p, 4]));
      if (isBatchMode) setBatchSelectedForConfirm(new Set(selectedBatchNfes.map((n) => n.id)));
    }
    setCurrentStep(step);
  };

  const startBatchConference = (mode: "together" | "one_by_one") => {
    setBatchConferenceMode(mode);
    setCurrentBatchNfIdx(0);
    if (mode === "together") {
      setConferenceItems(selectedBatchNfes.flatMap((n) => n.matches.map((m) => ({
        xmlProduct: m.xmlProduct, matchedProductId: m.matchedProductId, matchedProductName: m.matchedProductName,
        matchedProductBarcode: m.matchedProductBarcode, matchedProductSku: m.matchedProductSku, matchedProductGtinCx: null,
        matchedProductBoxQty: null, matchType: m.matchType, expectedQty: Math.floor(m.xmlProduct.quantity), scannedQty: 0,
        status: "pending", nfNumber: n.nfeData.number,
      }))));
    } else loadNfConference(0);
  };

  const finishCurrentNfConference = () => {
    setBatchNfes((prev) => prev.map((n) => n.id === selectedBatchNfes[currentBatchNfIdx]?.id ? { ...n, conferenceStatus: "done" } : n));
    if (currentBatchNfIdx < selectedBatchNfes.length - 1) loadNfConference(currentBatchNfIdx + 1);
  };

  const reset = () => {
    setCurrentStep(1); setCompletedSteps(new Set()); setNfMode("sefaz"); setNfeData(null); setMatches([]); 
    setConferenceItems([]); setDivergences([]); setAdjustedItems([]); setDone(false); setSaving(false);
    setBatchNfes([]); setSefazEntries([{ id: `init-${Date.now()}`, number: "", series: "001", status: "idle" }]);
    persistence.clearPersistedState();
  };

  const itemsToShow = adjustedItems.length > 0 ? adjustedItems : (isBatchMode ? selectedBatchNfes.flatMap((n) => n.matches) : matches);
  const totalValue = itemsToShow.reduce((sum, m) => sum + m.xmlProduct.totalValue, 0);

  const handleOpenNewProductDialog = () => {
    const candidate = itemsToShow.find(item => !item.matchedProductId || item.matchType === 'new' || item.matchType === 'none') || itemsToShow[0];
    
    if (candidate) {
      state.setNewProductData({
        name: candidate.xmlProduct.description,
        ean: candidate.xmlProduct.ean || "",
        sku: candidate.xmlProduct.code || candidate.xmlProduct.ean || "",
        price: candidate.xmlProduct.unitValue.toString()
      });
    } else {
      state.setNewProductData({ name: "", ean: "", sku: "", price: "" });
    }
    setNewProductDialog(true);
  };

  return (
    <>
      <BarcodeSearchDialogs
        notFoundOpen={barcodeSearch.notFoundOpen} setNotFoundOpen={barcodeSearch.setNotFoundOpen}
        boxDetectedOpen={barcodeSearch.boxDetectedOpen} setBoxDetectedOpen={barcodeSearch.setBoxDetectedOpen}
        codigo={barcodeSearch.lastCodigo} produto={barcodeSearch.lastResult?.produto} boxQty={barcodeSearch.lastResult?.qty}
        onConfirmBox={() => barcodeSearch.lastResult && bipHook.handleBip(barcodeSearch.lastCodigo)}
        onRegisterGtin={() => navigate("/produtos")} onRegisterProduct={() => navigate("/produtos")} onLinkProduct={() => navigate("/produtos")}
      />

      <div className="max-w-5xl mx-auto space-y-6 pb-8 px-4 sm:px-0 overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-bold">Entrada de Mercadoria</h1>
          <p className="text-sm text-muted-foreground mt-1">Passo {currentStep} — {STEP_LABELS[currentStep - 1]}</p>
        </div>

        <WizardProgress currentStep={currentStep} completedSteps={completedSteps} canGoToStep={canGoToStep} goToStep={goToStep} stepLabels={STEP_LABELS} />

        {currentStep === 1 && (
          <div className="space-y-6">
            <StepNF
              nfMode={nfMode} setNfMode={setNfMode} sefazEntries={sefazEntries} addSefazEntry={() => setSefazEntries([...sefazEntries, { id: generateId(), number: "", series: "001", status: "idle" }])}
              removeSefazEntry={(id) => setSefazEntries(sefazEntries.filter(e => e.id !== id))} updateSefazEntry={(id, f, v) => setSefazEntries(sefazEntries.map(e => e.id === id ? { ...e, [f]: v } : e))}
              loading={loading} batchSearchProgress={batchSearchProgress} dragOver={dragOver} setDragOver={setDragOver} handleBatchDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleBatchXmlUpload(e.dataTransfer.files); }}
              handleBatchXmlUpload={handleBatchXmlUpload} batchNfes={batchNfes} setBatchNfes={setBatchNfes} setNfeData={setNfeData} setMatches={setMatches} goToStep={goToStep} formatCurrency={formatCurrency}
              handleSefazSearch={async () => {
                const valid = sefazEntries.filter(e => {
                  const digits = normalizeDigits(e.number);
                  return digits.length >= 1 && digits.length <= 44;
                });
                
                if (valid.length === 0) {
                  toast({
                    title: "Número inválido",
                    description: "Informe o número da nota ou a chave de acesso de 44 dígitos.",
                    variant: "destructive"
                  });
                  return;
                }

                setLoading(true);
                setBatchSearchProgress({ current: 0, total: valid.length });
                
                try {
                  const dbProducts = await fetchProductsForMatching();
                  let processed = 0;
                  
                  for (const entry of valid) {
                    try {
                      const clean = normalizeDigits(entry.number);
                      const isFullChave = clean.length === 44;
                      
                      const { data, error } = await supabase.functions.invoke("nfe-consulta", { 
                        body: { 
                          chave: clean,
                          number: !isFullChave ? clean : undefined,
                          series: entry.series
                        } 
                      });
                      
                      if (error) {
                        console.error("Erro na chamada da Edge Function:", error);
                        let msg = "Falha ao conectar com o serviço de busca.";
                        if (error instanceof Error) msg = error.message;
                        else if (typeof error === 'object' && 'message' in error) msg = (error as any).message;
                        
                        if (msg.includes("Failed to send a request") || msg.includes("fetch")) {
                          msg = "Não foi possível alcançar o servidor. Verifique sua conexão ou se a função está ativa.";
                        }
                        
                        throw new Error(`Erro de comunicação: ${msg}`);
                      }

                      if (data?.error) {
                        throw new Error(data.error);
                      }

                      const nfe: NFeData = { 
                        number: data.numero, 
                        series: data.serie, 
                        issuerName: data.issuerName || `Emitente ${data.cnpjFormatado || "não identificado"}`, 
                        issuerCnpj: data.cnpjEmitente, 
                        totalValue: data.totalValue || 0, 
                        issueDate: data.dataEmissao, 
                        products: data.products || [] 
                      };

                      const matched = matchProducts(nfe.products, dbProducts);
                      
                      if (valid.length === 1) { 
                        setNfeData(nfe); 
                        setMatches(matched); 
                        if (isFullChave) setNfeChave(clean); 
                      }
                      
                      setBatchNfes(prev => [...prev, { 
                        id: generateId(), 
                        nfeData: nfe, 
                        matches: matched, 
                        selected: true, 
                        conferenceStatus: "pending", 
                        partialData: !!data.partialData, 
                        partialReason: data.partialReason 
                      }]);
                      
                    } catch (e: any) { 
                      console.error("Erro ao processar nota:", e);
                      toast({ 
                        title: "Erro na nota " + entry.number, 
                        description: e.message, 
                        variant: "destructive" 
                      }); 
                    }
                    processed++; 
                    setBatchSearchProgress({ current: processed, total: valid.length });
                  }
                } finally { 
                  setLoading(false); 
                }
              }}
            />
            {isBatchMode && !loading && (
              <BatchNfeList
                batchNfes={batchNfes} onToggle={(id) => setBatchNfes(batchNfes.map(n => n.id === id ? { ...n, selected: !n.selected } : n))}
                onToggleAll={() => { const all = batchNfes.every(n => n.selected); setBatchNfes(batchNfes.map(n => ({ ...n, selected: !all }))); }}
                onRemove={(id) => setBatchNfes(batchNfes.filter(n => n.id !== id))} goToStep={goToStep} formatCurrency={formatCurrency}
                selectedBatchNfes={selectedBatchNfes} batchTotalItems={selectedBatchNfes.reduce((s, n) => s + n.nfeData.products.length, 0)} batchTotalValue={selectedBatchNfes.reduce((s, n) => s + n.nfeData.totalValue, 0)}
              />
            )}
            <EntradaNotaHistorico />
          </div>
        )}

        {currentStep === 2 && (
          <StepConferencia
            isBatchMode={isBatchMode} selectedBatchNfes={selectedBatchNfes} batchConferenceMode={batchConferenceMode} currentBatchNfIdx={currentBatchNfIdx}
            batchConferenceDoneCount={batchNfes.filter(n => n.selected && n.conferenceStatus === "done").length} conferenceItems={conferenceItems}
            conferenceProgress={bipHook.conferenceProgress} bipInput={bipInput} setBipInput={setBipInput} bipRef={bipRef} handleBip={bipHook.handleBip} bipAlert={bipAlert}
            startBatchConference={startBatchConference} loadNfConference={loadNfConference} finishCurrentNfConference={finishCurrentNfConference}
            goToStep={goToStep} setConferenceItems={setConferenceItems} setCompletedSteps={setCompletedSteps} setCurrentStep={setCurrentStep} formatCurrency={formatCurrency}
            flashIdx={flashIdx} setUnknownGtinDialog={setUnknownGtinDialog} setUnknownGtinProduct={setUnknownGtinProduct} setUnknownGtinQty={setUnknownGtinQty} setUnknownGtinBoxes={setUnknownGtinBoxes} setUnknownGtinSave={setUnknownGtinSave}
          />
        )}

        {currentStep === 3 && (
          <StepDivergencias divergences={divergences} divergenceActions={divergenceActions} setDivergenceActions={setDivergenceActions} setConferenceItems={setConferenceItems} goToStep={goToStep} setCurrentStep={setCurrentStep} />
        )}

        {currentStep === 4 && (
          <StepAjustes
            itemsToShow={itemsToShow} adjustedItems={adjustedItems} updateAdjustedQty={(idx, q) => setAdjustedItems(prev => prev.map((item, i) => i === idx ? { ...item, xmlProduct: { ...item.xmlProduct, quantity: q } } : item))}
            updateAdjustedCost={(idx, c) => setAdjustedItems(prev => prev.map((item, i) => i === idx ? { ...item, xmlProduct: { ...item.xmlProduct, unitValue: c, totalValue: c * item.xmlProduct.quantity } } : item))}
            removeAdjustedItem={(idx) => setAdjustedItems(prev => prev.filter((_, i) => i !== idx))} onOpenNewProduct={handleOpenNewProductDialog} entryNotes={entryNotes} setEntryNotes={setEntryNotes} setCurrentStep={setCurrentStep} goToStep={goToStep} formatCurrency={formatCurrency} hasMatchesOrBatch={matches.length > 0 || isBatchMode}
            kitGroups={state.kitGroups}
            onCreateKit={(kg) => state.setKitGroups(prev => [...prev, kg])}
            onRemoveKitGroup={(id) => state.setKitGroups(prev => prev.filter(k => k.kitId !== id))}
          />
        )}

        {currentStep === 5 && !done && (
          <StepConfirmar
            isBatchMode={isBatchMode} selectedBatchNfes={selectedBatchNfes} batchSelectedForConfirm={batchSelectedForConfirm} setBatchSelectedForConfirm={setBatchSelectedForConfirm}
            nfeData={nfeData} itemsToShow={itemsToShow} totalValue={totalValue} autoUpdateStock={autoUpdateStock} setAutoUpdateStock={setAutoUpdateStock} autoUpdateCost={autoUpdateCost} setAutoUpdateCost={setAutoUpdateCost}
            confirmarEntrada={confirmHook.confirmarEntrada} saving={saving} formatCurrency={formatCurrency} setCurrentStep={setCurrentStep}
          />
        )}

        {currentStep === 5 && done && (
          <Dialog open={done} onOpenChange={() => {}}>
            <DialogContent className="max-w-md">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
                <div className="text-center space-y-1">
                  {isBatchMode && batchConfirmResult ? (
                    <>
                      <p className="text-lg font-bold">{batchConfirmResult.confirmed} nota(s) confirmada(s)!</p>
                      <p className="text-sm text-muted-foreground">{batchConfirmResult.products} produtos adicionados ao estoque</p>
                      <p className="text-lg font-bold text-primary mt-2">Total: {formatCurrency(batchConfirmResult.total)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold">Entrada realizada com sucesso!</p>
                      <p className="text-sm text-muted-foreground">{itemsToShow.length} produtos adicionados ao estoque</p>
                    </>
                  )}
                </div>
              </div>
              <DialogFooter className="flex gap-3 sm:gap-3">
                <Button variant="outline" className="flex-1" onClick={reset}>Nova entrada</Button>
                <Button className="flex-1" onClick={() => navigate("/estoque")}>Ver estoque</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <RestoreDialog open={persistence.showRestoreDialog} onRestore={persistence.restoreSavedState} onDiscard={persistence.discardSavedState} />

        <Dialog open={newProductDialog} onOpenChange={setNewProductDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Novo Produto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                <Input value={state.newProductData.name} onChange={e => state.setNewProductData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">SKU *</label>
                <Input value={state.newProductData.sku} onChange={e => state.setNewProductData(p => ({ ...p, sku: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">EAN</label>
                <Input value={state.newProductData.ean} onChange={e => state.setNewProductData(p => ({ ...p, ean: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço de Custo/Venda</label>
                <Input type="number" step="0.01" value={state.newProductData.price} onChange={e => state.setNewProductData(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewProductDialog(false)}>Cancelar</Button>
              <Button onClick={async () => {
                try {
                  const { name, sku, ean, price } = state.newProductData;
                  const unitValue = parseFloat(price) || 0;
                  const { error } = await supabase.from("products").insert({ 
                    name, 
                    sku, 
                    barcode: ean || null, 
                    ean: ean || null,
                    price: unitValue,
                    cost: unitValue,
                    company_id: companyId 
                  });
                  
                  if (error) throw error;
                  
                  toast({ title: "Produto cadastrado!" }); 
                  setNewProductDialog(false);
                  queryClient.invalidateQueries({ queryKey: ["products"] });
                } catch (e: any) { 
                  toast({ title: "Erro", description: e.message, variant: "destructive" }); 
                }
              }}>Cadastrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!unknownGtinDialog} onOpenChange={(v) => { if (!v) { setUnknownGtinDialog(null); setTimeout(() => bipRef.current?.focus(), 50); } }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle><Package className="h-5 w-5 text-primary" /> Configurar entrada em caixa</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Unidades/caixa</label><Input type="number" value={unknownGtinQty} onChange={e => setUnknownGtinQty(parseInt(e.target.value) || 1)} /></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Caixas</label><Input type="number" value={unknownGtinBoxes} onChange={e => setUnknownGtinBoxes(parseInt(e.target.value) || 1)} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => { setUnknownGtinDialog(null); setTimeout(() => bipRef.current?.focus(), 50); }}>Cancelar</Button>
              <Button onClick={() => {
                const total = unknownGtinQty * unknownGtinBoxes;
                const idx = parseInt(unknownGtinProduct.replace("idx-", ""), 10);
                if (!isNaN(idx)) {
                  setConferenceItems(prev => {
                    const next = [...prev]; const item = { ...next[idx] }; item.scannedQty += total;
                    item.boxBadge = `📦 ${unknownGtinBoxes}cx × ${unknownGtinQty}un = ${total}un`;
                    item.status = item.scannedQty === item.expectedQty ? "ok" : item.scannedQty > item.expectedQty ? "excess" : "partial";
                    next[idx] = item; return next;
                  });
                  bipHook.playBeep(800, 100);
                }
                setUnknownGtinDialog(null); setTimeout(() => bipRef.current?.focus(), 50);
              }}>Confirmar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default EntradaNota;
