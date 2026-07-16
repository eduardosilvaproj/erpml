import { useState } from "react";
import { type WizardStep, type ConferenceItem, type BatchNfe, type SefazEntry, type KitGroup } from "../types";
import { type NFeData, type MatchResult } from "@/lib/nfe-parser";

export const useEntradaNotaState = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 - NF
  const [nfMode, setNfMode] = useState<"sefaz" | "xml">("sefaz");
  const [nfNumber, setNfNumber] = useState("");
  const [nfSeries, setNfSeries] = useState("001");
  const [nfFornecedor, setNfFornecedor] = useState("");
  const [nfDate, setNfDate] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [nfeChave, setNfeChave] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);

  // Step 1 - NFs loaded
  const [batchNfes, setBatchNfes] = useState<BatchNfe[]>([]);
  const [sefazEntries, setSefazEntries] = useState<SefazEntry[]>([{ id: `init-${Date.now()}`, number: "", series: "001", status: "idle" }]);
  const [batchSearching, setBatchSearching] = useState(false);
  const [batchSearchProgress, setBatchSearchProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  // Step 2 - Conference
  const [conferenceItems, setConferenceItems] = useState<ConferenceItem[]>([]);
  const [bipInput, setBipInput] = useState("");
  const [bipAlert, setBipAlert] = useState<{ type: "success" | "warning" | "error"; msg: string } | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [batchConferenceMode, setBatchConferenceMode] = useState<"together" | "one_by_one" | null>(null);
  const [currentBatchNfIdx, setCurrentBatchNfIdx] = useState(0);

  const [boxBipDialog, setBoxBipDialog] = useState<{ code: string; productIdx?: number; productName?: string; qtyPerBox?: number } | null>(null);
  const [unknownGtinDialog, setUnknownGtinDialog] = useState<{ code: string } | null>(null);
  const [unknownGtinProduct, setUnknownGtinProduct] = useState("");
  const [unknownGtinQty, setUnknownGtinQty] = useState(1);
  const [unknownGtinBoxes, setUnknownGtinBoxes] = useState(1);
  const [unknownGtinSave, setUnknownGtinSave] = useState(true);

  // Step 3 - Divergences
  const [divergences, setDivergences] = useState<ConferenceItem[]>([]);
  const [divergenceActions, setDivergenceActions] = useState<Record<number, "conferida" | "nota">>({});

  // Step 4 - Adjustments
  const [adjustedItems, setAdjustedItems] = useState<MatchResult[]>([]);
  const [kitGroups, setKitGroups] = useState<KitGroup[]>([]);
  const [newProductDialog, setNewProductDialog] = useState(false);
  const [newProductData, setNewProductData] = useState({ name: "", ean: "", sku: "", price: "" });
  const [entryNotes, setEntryNotes] = useState("");

  // Step 5 - Confirm
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [autoUpdateCost, setAutoUpdateCost] = useState(true);
  const [batchSelectedForConfirm, setBatchSelectedForConfirm] = useState<Set<string>>(new Set());
  const [batchConfirmResult, setBatchConfirmResult] = useState<{ confirmed: number; products: number; total: number } | null>(null);

  return {
    currentStep, setCurrentStep,
    completedSteps, setCompletedSteps,
    nfMode, setNfMode,
    nfNumber, setNfNumber,
    nfSeries, setNfSeries,
    nfFornecedor, setNfFornecedor,
    nfDate, setNfDate,
    manualKey, setManualKey,
    loading, setLoading,
    nfeData, setNfeData,
    nfeChave, setNfeChave,
    matches, setMatches,
    batchNfes, setBatchNfes,
    sefazEntries, setSefazEntries,
    batchSearching, setBatchSearching,
    batchSearchProgress, setBatchSearchProgress,
    dragOver, setDragOver,
    conferenceItems, setConferenceItems,
    bipInput, setBipInput,
    bipAlert, setBipAlert,
    flashIdx, setFlashIdx,
    batchConferenceMode, setBatchConferenceMode,
    currentBatchNfIdx, setCurrentBatchNfIdx,
    boxBipDialog, setBoxBipDialog,
    unknownGtinDialog, setUnknownGtinDialog,
    unknownGtinProduct, setUnknownGtinProduct,
    unknownGtinQty, setUnknownGtinQty,
    unknownGtinBoxes, setUnknownGtinBoxes,
    unknownGtinSave, setUnknownGtinSave,
    divergences, setDivergences,
    divergenceActions, setDivergenceActions,
    adjustedItems, setAdjustedItems,
    kitGroups, setKitGroups,
    newProductDialog, setNewProductDialog,
    newProductData, setNewProductData,
    entryNotes, setEntryNotes,
    saving, setSaving,
    done, setDone,
    autoUpdateStock, setAutoUpdateStock,
    autoUpdateCost, setAutoUpdateCost,
    batchSelectedForConfirm, setBatchSelectedForConfirm,
    batchConfirmResult, setBatchConfirmResult
  };
};
