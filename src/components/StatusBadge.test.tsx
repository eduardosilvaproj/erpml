import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatusBadge } from "./StatusBadge";
import { AuditProvider } from "@/contexts/AuditContext";
import React from "react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("StatusBadge Integration", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("deve renderizar com estilo de modo de auditoria quando audit_mode é 'true' no localStorage", () => {
    localStorage.setItem("audit_mode", "true");

    render(
      <AuditProvider>
        <StatusBadge status="OK" />
      </AuditProvider>
    );

    const badge = screen.getByRole("status");
    // O aria-label deve indicar que o modo de auditoria está ativo
    expect(badge).toHaveAttribute("aria-label", "Status: OK - Modo de Auditoria Ativo");
    
    // Deve conter as classes de estilo de auditoria (borda tracejada)
    expect(badge.className).toContain("border-dashed");
    
    // O indicador de pulso deve estar presente
    const pulseIndicator = badge.querySelector(".animate-pulse");
    expect(pulseIndicator).not.toBeNull();
  });

  it("deve renderizar normalmente quando audit_mode não está definido no localStorage", () => {
    render(
      <AuditProvider>
        <StatusBadge status="OK" />
      </AuditProvider>
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Status: OK");
    expect(badge.className).not.toContain("border-dashed");
    
    const pulseIndicator = badge.querySelector(".animate-pulse");
    expect(pulseIndicator).toBeNull();
  });

  it("deve respeitar a prop isAudit mesmo se o modo de auditoria estiver desligado", () => {
    render(
      <AuditProvider>
        <StatusBadge status="OK" isAudit={true} />
      </AuditProvider>
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Status: OK - Modo de Auditoria Ativo");
    expect(badge.className).toContain("border-dashed");
  });

  it("deve respeitar a prop isAudit=false mesmo se o modo de auditoria estiver ligado no contexto", () => {
    localStorage.setItem("audit_mode", "true");

    render(
      <AuditProvider>
        <StatusBadge status="OK" isAudit={false} />
      </AuditProvider>
    );

    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "Status: OK");
    expect(badge.className).not.toContain("border-dashed");
  });

  it("deve renderizar corretamente o status 'Pendente' (case insensitive)", () => {
    render(
      <AuditProvider>
        <StatusBadge status="pendente" />
      </AuditProvider>
    );

    expect(screen.getByText("Pendente")).toBeDefined();
    const badge = screen.getByRole("status");
    // Verificamos se usa a variante secundária (bg-secondary)
    expect(badge.className).toContain("bg-secondary");
  });
});
