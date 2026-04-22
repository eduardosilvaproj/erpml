import React, { createContext, useContext, useState, useEffect } from "react";

interface AuditContextType {
  isAuditMode: boolean;
  initialized: boolean;
  toggleAuditMode: () => void;
  setAuditMode: (enabled: boolean) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("audit_mode");
    if (saved === "true") {
      setIsAuditMode(true);
    }
    setInitialized(true);
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
    <AuditContext.Provider value={{ isAuditMode, toggleAuditMode, setAuditMode }}>
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
