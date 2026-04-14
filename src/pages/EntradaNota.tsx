import { useState, useCallback } from "react";
import {
  Camera, FileText, Loader2, CheckCircle, AlertTriangle,
  ArrowLeft, Save, ScanBarcode, Keyboard, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";

type Step = "scan" | "loading" | "preview" | "saving" | "done" | "error";

interface NFeResult {
  chave: string;
  numero: string;
  serie: string;
  cnpjEmitente: string;
  cnpjFormatado: string;
  uf: string;
  dataEmissao: string;
  modelo: string;
  tipoEmissao: string;
  fonte: string;
}

const EntradaNota = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("scan");
  const [nfeData, setNfeData] = useState<NFeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [manualInput, setManualInput] = useState(false);
  const [manualKey, setManualKey] = useState("");

  const consultarChave = useCallback(async (chave: string) => {
    const clean = chave.replace(/\D/g, "");
    if (clean.length !== 44) {
      setErrorMsg("Código inválido. A chave de acesso da NF-e deve ter 44 dígitos.");
      setStep("error");
      return;
    }

    setStep("loading");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("nfe-consulta", {
        body: { chave: clean },
      });

      if (error) throw new Error(error.message || "Erro na consulta");
      if (data?.error) throw new Error(data.error);

      setNfeData(data);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao consultar nota fiscal.");
      setStep("error");
    }
  }, []);

  const handleScan = useCallback((code: string) => {
    consultarChave(code);
  }, [consultarChave]);

  const handleManualSubmit = () => {
    if (manualKey.replace(/\D/g, "").length < 44) {
      toast({ title: "Chave inválida", description: "Digite os 44 dígitos da chave de acesso.", variant: "destructive" });
      return;
    }
    consultarChave(manualKey);
  };

  const salvarNota = async () => {
    if (!nfeData) return;

    setStep("saving");

    try {
      // Check if invoice already exists by number + CNPJ + company
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("number", nfeData.numero)
        .eq("issuer_cnpj", nfeData.cnpjEmitente)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Nota já importada", description: `NF-e nº ${nfeData.numero} já existe no sistema.`, variant: "destructive" });
        setStep("preview");
        return;
      }

      const { error: insertError } = await supabase
        .from("invoices")
        .insert({
          number: nfeData.numero,
          series: nfeData.serie,
          issuer_cnpj: nfeData.cnpjEmitente,
          issuer_name: `Emitente ${nfeData.cnpjFormatado} (${nfeData.uf})`,
          total_value: 0,
          status: "importada",
          items_count: 0,
          company_id: companyId,
        });

      if (insertError) {
        // Handle duplicate key constraint violation gracefully
        if (insertError.code === "23505") {
          toast({ title: "Nota já importada", description: `NF-e nº ${nfeData.numero} já existe no sistema.`, variant: "destructive" });
          setStep("preview");
          return;
        }
        throw insertError;
      }

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });

      setStep("done");
      toast({ title: "Nota registrada!", description: `NF-e nº ${nfeData.numero} salva com sucesso.` });
    } catch (err: any) {
      setErrorMsg("Erro ao salvar nota fiscal. Tente novamente.");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("scan");
    setNfeData(null);
    setErrorMsg("");
    setManualKey("");
    setManualInput(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] rounded-lg" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Entrada de Nota</h1>
          <p className="text-xs text-muted-foreground">Escaneie o código de barras da NF-e</p>
        </div>
      </div>

      {/* Step: Scan */}
      {step === "scan" && (
        <div className="space-y-4">
          {!manualInput ? (
            <>
              <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-4">
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
                      <ScanBarcode className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Aponte a câmera para o código de barras</p>
                    <p className="text-xs text-muted-foreground">Localize o código de barras na parte inferior do DANFE</p>
                  </div>

                  <BarcodeScanner onScan={handleScan} />
                </CardContent>
              </Card>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full min-h-[48px] gap-2 text-sm"
                onClick={() => setManualInput(true)}
              >
                <Keyboard className="h-4 w-4" />
                Digitar chave de acesso manualmente
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Chave de Acesso (44 dígitos)</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setManualInput(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  className="min-h-[48px] text-base font-mono tracking-wider"
                  maxLength={54}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  {manualKey.replace(/\D/g, "").length}/44 dígitos
                </p>
                <Button
                  className="w-full min-h-[48px]"
                  onClick={handleManualSubmit}
                  disabled={manualKey.replace(/\D/g, "").length < 44}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Consultar Nota
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step: Loading */}
      {step === "loading" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Consultando nota fiscal...</p>
              <p className="text-xs text-muted-foreground">Validando chave de acesso</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && nfeData && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold">{nfeData.modelo} nº {nfeData.numero}</p>
                  <p className="text-xs text-muted-foreground">Série {nfeData.serie}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-primary/30 text-primary bg-primary/5">
                  {nfeData.uf}
                </Badge>
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CNPJ Emitente</p>
                  <p className="text-sm font-medium mt-0.5">{nfeData.cnpjFormatado}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data Emissão</p>
                  <p className="text-sm font-medium mt-0.5">{new Date(nfeData.dataEmissao).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Chave de Acesso</p>
                <p className="text-xs font-mono mt-1 break-all text-muted-foreground leading-relaxed">
                  {nfeData.chave.replace(/(\d{4})/g, "$1 ").trim()}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={reset}>
              Escanear outra
            </Button>
            <Button className="flex-1 min-h-[48px] gap-2" onClick={salvarNota}>
              <Save className="h-4 w-4" />
              Salvar Nota
            </Button>
          </div>
        </div>
      )}

      {/* Step: Saving */}
      {step === "saving" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium">Salvando nota fiscal...</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="space-y-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-green-500/15 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-green-700">Nota registrada!</p>
                <p className="text-sm text-muted-foreground">
                  NF-e nº {nfeData?.numero} foi salva com sucesso.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={reset}>
              <Camera className="h-4 w-4 mr-2" />
              Escanear outra
            </Button>
            <Button className="flex-1 min-h-[48px]" onClick={() => navigate("/entrada-xml")}>
              <FileText className="h-4 w-4 mr-2" />
              Ver Notas
            </Button>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <div className="space-y-4">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-destructive/15 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-destructive">Erro na consulta</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full min-h-[48px]" onClick={reset}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default EntradaNota;
