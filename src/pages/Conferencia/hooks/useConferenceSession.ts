import { useState, useEffect, useCallback } from "react";
import type { ConferenceMode, ConferenceType, Step, ScannedProduct } from "../types";

const STORAGE_KEY = "conferencia_session";

interface SessionData {
  step: Step;
  mode: ConferenceMode | null;
  conferenceName: string;
  conferenceType: ConferenceType;
  sectionName: string;
  conferenceId: string | null;
  scannedProducts: ScannedProduct[];
  savedAt: string;
}

export function useConferenceSession() {
  const [sessionRestored, setSessionRestored] = useState(false);

  const saveSession = useCallback((data: Partial<SessionData>) => {
    try {
      const isEmptySession =
        data.step === 1 &&
        !data.mode &&
        !data.conferenceName &&
        !data.conferenceId &&
        (!data.scannedProducts || data.scannedProducts.length === 0);

      if (isEmptySession) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const payload = {
        ...data,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("[useConferenceSession] Save error:", error);
    }
  }, []);

  const restoreSession = useCallback((): SessionData | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw) as SessionData;

      const isEmptySession =
        data.step === 1 &&
        !data.mode &&
        !data.conferenceName &&
        !data.conferenceId &&
        (!data.scannedProducts || data.scannedProducts.length === 0);

      if (isEmptySession) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      setSessionRestored(true);
      return data;
    } catch (error) {
      console.error("[useConferenceSession] Restore error:", error);
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSessionRestored(false);
    } catch (error) {
      console.error("[useConferenceSession] Clear error:", error);
    }
  }, []);

  return {
    saveSession,
    restoreSession,
    clearSession,
    sessionRestored,
    setSessionRestored,
  };
}
