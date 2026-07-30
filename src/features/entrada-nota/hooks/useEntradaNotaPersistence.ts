import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { type WizardStep, type ConferenceItem, type BatchNfe, type KitGroup } from "../types";

const STORAGE_KEY = "entrada_nota_wizard_state";

interface PersistenceInput {
  currentStep: WizardStep;
  completedSteps: Set<number>;
  conferenceItems: ConferenceItem[];
  batchNfes: BatchNfe[];
  batchConferenceMode: "together" | "one_by_one" | null;
  currentBatchNfIdx: number;
  divergences: ConferenceItem[];
  divergenceActions: Record<number, "conferida" | "nota">;
  adjustedItems: any[];
  kitGroups: KitGroup[];
  entryNotes: string;
  autoUpdateStock: boolean;
  autoUpdateCost: boolean;
  done: boolean;
  nfMode: "sefaz" | "xml";
  nfeChave: string;
}

interface Setters {
  setCurrentStep: (s: WizardStep) => void;
  setCompletedSteps: (s: Set<number>) => void;
  setConferenceItems: (items: ConferenceItem[]) => void;
  setBatchNfes: (items: BatchNfe[]) => void;
  setBatchConferenceMode: (m: "together" | "one_by_one" | null) => void;
  setCurrentBatchNfIdx: (idx: number) => void;
  setDivergences: (items: ConferenceItem[]) => void;
  setDivergenceActions: (actions: Record<number, "conferida" | "nota">) => void;
  setAdjustedItems: (items: any[]) => void;
  setKitGroups: (groups: KitGroup[]) => void;
  setEntryNotes: (notes: string) => void;
  setAutoUpdateStock: (v: boolean) => void;
  setAutoUpdateCost: (v: boolean) => void;
  setNfMode: (m: "sefaz" | "xml") => void;
  setNfeChave: (k: string) => void;
}

export const useEntradaNotaPersistence = (state: PersistenceInput, setters: Setters) => {
  const { toast } = useToast();
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  useEffect(() => {
    if (state.done || (state.currentStep === 1 && state.conferenceItems.length === 0 && state.batchNfes.length === 0)) return;
    try {
      const stateToSave = {
        ...state,
        completedSteps: Array.from(state.completedSteps),
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {}
  }, [
    state.currentStep, state.completedSteps, state.conferenceItems, state.batchNfes, 
    state.batchConferenceMode, state.currentBatchNfIdx, state.divergences, 
    state.divergenceActions, state.adjustedItems, state.entryNotes, 
    state.autoUpdateStock, state.autoUpdateCost, state.done, state.nfMode, state.nfeChave, state.kitGroups
  ]);


  useEffect(() => {
    if (hasRestoredState) return;
    setHasRestoredState(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 && (parsed.conferenceItems?.length > 0 || parsed.batchNfes?.length > 0)) {
        setShowRestoreDialog(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, [hasRestoredState]);

  const restoreSavedState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.currentStep) setters.setCurrentStep(s.currentStep);
      if (s.completedSteps) setters.setCompletedSteps(new Set(s.completedSteps));
      if (s.conferenceItems) setters.setConferenceItems(s.conferenceItems);
      if (s.batchNfes) setters.setBatchNfes(s.batchNfes);
      if (s.batchConferenceMode) setters.setBatchConferenceMode(s.batchConferenceMode);
      if (s.currentBatchNfIdx != null) setters.setCurrentBatchNfIdx(s.currentBatchNfIdx);
      if (s.divergences) setters.setDivergences(s.divergences);
      if (s.divergenceActions) setters.setDivergenceActions(s.divergenceActions);
      if (s.adjustedItems) setters.setAdjustedItems(s.adjustedItems);
      if (s.kitGroups) setters.setKitGroups(s.kitGroups);
      if (s.entryNotes) setters.setEntryNotes(s.entryNotes);
      if (s.autoUpdateStock != null) setters.setAutoUpdateStock(s.autoUpdateStock);
      if (s.autoUpdateCost != null) setters.setAutoUpdateCost(s.autoUpdateCost);
      if (s.nfMode) setters.setNfMode(s.nfMode);
      if (s.nfeChave) setters.setNfeChave(s.nfeChave);
      if (s.kitGroups) setters.setKitGroups(s.kitGroups);
      toast({ title: "Progresso restaurado!", description: "Continuando de onde você parou." });
    } catch {}
    setShowRestoreDialog(false);
  };

  const discardSavedState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowRestoreDialog(false);
  };

  const clearPersistedState = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return {
    showRestoreDialog,
    setShowRestoreDialog,
    restoreSavedState,
    discardSavedState,
    clearPersistedState
  };
};
