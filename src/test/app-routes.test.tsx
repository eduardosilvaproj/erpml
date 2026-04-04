import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router-dom";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

describe("Public Routes", () => {
  it("renders login form with email and password fields", () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("renders signup form with name, email and password fields", () => {
    renderWithProviders(<Signup />);
    expect(screen.getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("renders forgot password page", () => {
    renderWithProviders(<ForgotPassword />);
    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("login page has links to signup and forgot password", () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole("link", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Esqueci a senha" })).toBeInTheDocument();
  });
});
