import { useDashboardData, type PeriodFilter } from "@/hooks/useDashboardData";
import { useMLDashboardMetrics } from "@/hooks/useMLDashboardMetrics";
import { useMLConnection } from "@/hooks/useMLData";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";

const PERIOD_DAYS: Record<PeriodFilter, number> = {
  today: 1,
  "7d": 7,
  "14d": 14,
  "15d": 15,
  "30d": 30,
  "39d": 39,
  "6m": 180,
  "1a": 365,
};

const periodLabels: Record<PeriodFilter, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "14d": "14 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  "39d": "39 dias",
  "6m": "6 meses",
  "1a": "1 ano",
};

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="report-section">
      <h2 className="report-section-title">{title}</h2>
      {children}
    </div>
  );
}

function ReportRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="report-row">
      <span className="report-label">{label}</span>
      <span className={`report-value ${negative ? "report-negative" : ""}`}>{value}</span>
    </div>
  );
}

export function ReportPDF({ period }: { period: PeriodFilter }) {
  const periodDays = PERIOD_DAYS[period] ?? 30;
  const { data: mlConnection } = useMLConnection();
  const { metrics: mlMetrics } = useMLDashboardMetrics(periodDays);
  const { data, isLoading } = useDashboardData(
    period,
    mlConnection
      ? {
          grossRevenue: mlMetrics.grossRevenue,
          totalFees: mlMetrics.totalFees,
          totalShipping: mlMetrics.totalShipping,
          netRevenue: mlMetrics.netRevenue,
          totalOrders: mlMetrics.totalOrders,
        }
      : undefined
  );

  const now = new Date();
  const reportDate = formatDate(now);
  const reportTime = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (isLoading) {
    return (
      <div className="report-container">
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="report-container">
      {/* Header */}
      <div className="report-header">
        <div>
          <h1 className="report-title">Relatorio de Metricas</h1>
          <p className="report-subtitle">
            Periodo: {periodLabels[period]} | Gerado em: {reportDate} as {reportTime}
          </p>
        </div>
        <div className="report-logo">
          <span className="text-2xl font-bold text-primary">BIPSTOCK</span>
        </div>
      </div>

      {/* Resumo Executivo */}
      <ReportSection title="Resumo Executivo">
        <ReportRow label="Receita Total (PDV + ML)" value={formatCurrency(data?.consolidatedRevenue ?? 0)} />
        <ReportRow label="Lucro Liquido" value={formatCurrency(data?.netProfit ?? 0)} />
        <ReportRow label="Margem de Lucro" value={`${data?.profitMargin.toFixed(1) ?? "0.0"}%`} />
        <ReportRow label="Total de Vendas" value={String(data?.totalSales ?? 0)} />
        <ReportRow label="Ticket Medio" value={formatCurrency(data?.avgTicket ?? 0)} />
      </ReportSection>

      {/* Vendas PDV */}
      <ReportSection title="Vendas PDV">
        <ReportRow label="Receita PDV" value={formatCurrency(data?.revenue ?? 0)} />
        <ReportRow label="Produtos em Estoque" value={String(data?.totalProducts ?? 0)} />
        <ReportRow label="Total de Clientes" value={String(data?.totalCustomers ?? 0)} />
        <ReportRow label="Novos Clientes (periodo)" value={String(data?.newCustomers ?? 0)} />
      </ReportSection>

      {/* Mercado Livre */}
      {mlConnection && (
        <ReportSection title="Mercado Livre">
          <ReportRow label="Pedidos ML" value={String(mlMetrics.totalOrders)} />
          <ReportRow label="Receita Bruta ML" value={formatCurrency(mlMetrics.grossRevenue)} />
          <ReportRow label="Taxas ML" value={formatCurrency(mlMetrics.totalFees)} negative />
          <ReportRow label="Fretes ML" value={formatCurrency(mlMetrics.totalShipping)} negative />
          <ReportRow label="Receita Liquida ML" value={formatCurrency(mlMetrics.netRevenue)} />
          <ReportRow label="Margem ML" value={`${mlMetrics.margin.toFixed(1)}%`} />
          <ReportRow label="Ticket Medio ML" value={formatCurrency(mlMetrics.avgTicket)} />
        </ReportSection>
      )}

      {/* Estoque */}
      <ReportSection title="Estoque">
        <ReportRow label="Produtos Ativos" value={String(data?.totalProducts ?? 0)} />
        <ReportRow label="Estoque Baixo" value={String(data?.lowStockCount ?? 0)} negative={(data?.lowStockCount ?? 0) > 0} />
        <ReportRow label="Sem Estoque" value={String(data?.outOfStockCount ?? 0)} negative={(data?.outOfStockCount ?? 0) > 0} />
        <ReportRow label="Envios Pendentes" value={String(data?.pendingShipments ?? 0)} negative={(data?.pendingShipments ?? 0) > 0} />
        <ReportRow label="Envios Realizados" value={String(data?.sentShipments ?? 0)} />
      </ReportSection>

      {/* Top Produtos */}
      {data?.topProducts && data.topProducts.length > 0 && (
        <ReportSection title="Produtos Mais Vendidos">
          <table className="report-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Receita</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="text-center">{p.qty}</td>
                  <td className="text-right">{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* Alertas */}
      {data?.alerts && data.alerts.length > 0 && (
        <ReportSection title="Alertas">
          {data.alerts.map((a, i) => (
            <div key={i} className={`report-alert report-alert-${a.type}`}>
              {a.message}
            </div>
          ))}
        </ReportSection>
      )}

      {/* Footer */}
      <div className="report-footer">
        <p>BIPSTOCK - Sistema de Gestao Empresarial</p>
        <p>Relatorio gerado automaticamente pelo Assistente Ana</p>
      </div>

      <style>{`
        .report-container {
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 32px;
          color: #1a1a2e;
          background: #ffffff;
        }
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #6366f1;
          padding-bottom: 20px;
          margin-bottom: 28px;
        }
        .report-title {
          font-size: 26px;
          font-weight: 800;
          color: #1a1a2e;
          margin: 0;
          line-height: 1.2;
        }
        .report-subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0 0 0;
        }
        .report-logo {
          text-align: right;
        }
        .report-section {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .report-section-title {
          font-size: 16px;
          font-weight: 700;
          color: #6366f1;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .report-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px dashed #f1f5f9;
        }
        .report-label {
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }
        .report-value {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }
        .report-negative {
          color: #ef4444;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .report-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 2px solid #e2e8f0;
        }
        .report-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .report-table tr:last-child td {
          border-bottom: none;
        }
        .report-alert {
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .report-alert-error {
          background: #fef2f2;
          color: #dc2626;
          border-left: 4px solid #dc2626;
        }
        .report-alert-warning {
          background: #fffbeb;
          color: #d97706;
          border-left: 4px solid #f59e0b;
        }
        .report-alert-info {
          background: #eff6ff;
          color: #2563eb;
          border-left: 4px solid #3b82f6;
        }
        .report-footer {
          margin-top: 36px;
          padding-top: 16px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
        }
        .report-footer p {
          margin: 2px 0;
        }
        @media print {
          .report-container {
            padding: 20px;
            max-width: 100%;
          }
          .report-section {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
