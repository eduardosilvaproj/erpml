import React, { createContext, useContext, useState, useEffect } from "react";

interface AuditContextType {
  isAuditMode: boolean;
  toggleAuditMode: () => void;
  setAuditMode: (enabled: boolean) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuditMode, setIsAuditMode] = useState(() => {
    const saved = localStorage.getItem("audit_mode");
    return saved === "true";
  });

  const toggleAuditMode = () => {
    setIsAuditMode((prev) => !prev);
  };

  const setAuditMode = (enabled: boolean) => {
    setIsAuditMode(enabled);
  };

  useEffect(() => {
    localStorage.setItem("audit_mode", String(isAuditMode));
  }, [isAuditMode]);

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
