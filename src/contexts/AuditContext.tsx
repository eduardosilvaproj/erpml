import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";

interface AuditContextType {
  isAuditMode: boolean;
  initialized: boolean;
  toggleAuditMode: () => void;
  setAuditMode: (enabled: boolean) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuditMode, setIsAuditMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("audit_mode") === "true";
    }
    return false;
  });
  const [initialized, setInitialized] = useState(true);

  // We still want to handle potential changes in localStorage from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "audit_mode") {
        setIsAuditMode(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);


  const toggleAuditMode = () => {
    setIsAuditMode((prev) => !prev);
  };

  const setAuditMode = (enabled: boolean) => {
    setIsAuditMode(enabled);
  };

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("audit_mode", String(isAuditMode));
    }
  }, [isAuditMode, initialized]);

  return (
    <AuditContext.Provider value={{ isAuditMode, initialized, toggleAuditMode, setAuditMode }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
};
