import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
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
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders sidebar with all module links", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("Produtos")).toBeInTheDocument();
    expect(screen.getByText("Entrada XML")).toBeInTheDocument();
    expect(screen.getByText("Conferência")).toBeInTheDocument();
    expect(screen.getByText("Estoque")).toBeInTheDocument();
    expect(screen.getByText("Envio FULL")).toBeInTheDocument();
    expect(screen.getByText("PDV")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Painel HUB")).toBeInTheDocument();
  });

  it("renders ERP System header", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("Sistema ERP")).toBeInTheDocument();
  });
});
