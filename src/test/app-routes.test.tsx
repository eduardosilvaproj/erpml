import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "@/App";

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
};

describe("App Routes", () => {
  it("renders dashboard at /", () => {
    renderWithProviders(<App />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders sidebar with all module links", () => {
    renderWithProviders(<App />);
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    expect(sidebar).toBeTruthy();
    
    // Check sidebar links exist
    const links = sidebar!.querySelectorAll("a");
    const linkTexts = Array.from(links).map((l) => l.textContent?.trim());
    expect(linkTexts).toContain("Dashboard");
    expect(linkTexts).toContain("Produtos");
    expect(linkTexts).toContain("Entrada XML");
    expect(linkTexts).toContain("Conferência");
    expect(linkTexts).toContain("Estoque");
    expect(linkTexts).toContain("Envio FULL");
    expect(linkTexts).toContain("PDV");
    expect(linkTexts).toContain("CRM");
    expect(linkTexts).toContain("Painel HUB");
  });

  it("renders ERP System header", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("Sistema ERP")).toBeInTheDocument();
    expect(screen.getByText("ERP System")).toBeInTheDocument();
  });
});
