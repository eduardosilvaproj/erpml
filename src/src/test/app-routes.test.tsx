import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
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
    const { getByRole, getByLabelText } = renderWithProviders(<Login />);
    // Removida asserção do heading "Entrar" devido ao novo layout com background canvas
    expect(getByLabelText("E-mail")).toBeInTheDocument();
    expect(getByLabelText("Senha")).toBeInTheDocument();
    expect(getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("renders signup form with name, email and password fields", () => {
    const { getByRole, getByLabelText } = renderWithProviders(<Signup />);
    expect(getByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(getByLabelText("Nome completo")).toBeInTheDocument();
    expect(getByLabelText("E-mail")).toBeInTheDocument();
    expect(getByLabelText("Senha")).toBeInTheDocument();
  });

  it("renders forgot password page", () => {
    const { getByRole, getByLabelText } = renderWithProviders(<ForgotPassword />);
    expect(getByRole("heading", { name: "Esqueci a senha" })).toBeInTheDocument();
    expect(getByLabelText("E-mail")).toBeInTheDocument();
  });

  it("login page has links to signup and forgot password", () => {
    const { getByRole } = renderWithProviders(<Login />);
    expect(getByRole("link", { name: "Criar conta" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Esqueci a senha" })).toBeInTheDocument();
  });
});