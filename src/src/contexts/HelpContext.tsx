import { useState, useEffect, createContext, useContext, ReactNode } from "react";

const STORAGE_KEY = "erp-help-enabled";

interface HelpContextType {
  helpEnabled: boolean;
  setHelpEnabled: (v: boolean) => void;
}

const HelpContext = createContext<HelpContextType>({ helpEnabled: true, setHelpEnabled: () => {} });

export const useHelp = () => useContext(HelpContext);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [helpEnabled, setHelpEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved === "true" : true;
    } catch { return true; }
  });

  const setHelpEnabled = (v: boolean) => {
    setHelpEnabledState(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
  };

  return (
    <HelpContext.Provider value={{ helpEnabled, setHelpEnabled }}>
      {children}
    </HelpContext.Provider>
  );
}
