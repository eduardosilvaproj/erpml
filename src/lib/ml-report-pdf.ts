import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo-erp.png";

interface MLReportData {
  periodLabel: string;
  periodDays: number;
  grossRevenue: number;
  totalFees: number;
  totalShipping: number;
  netRevenue: number;
  margin: number;
  avgTicket: number;
  totalOrders: number;
  revenueTrend: number;
  topProducts: { title: string; qty: number; revenue: number }[];
  statusCounts: Record<string, number>;
  shippingStatusCounts: Record<string, number>;
  dailyData: { label: string; receita: number; comissao: number; frete: number }[];
  companyName?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function generateMLReportPDF(data: MLReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Load logo
  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadImageAsDataUrl(logoUrl);
  } catch {
    // proceed without logo
  }

  // --- Header ---
  doc.setFillColor(30, 30, 45);
  doc.rect(0, 0, pageW, 42, "F");

  // Logo
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 4, 18, 18);
  }

  const textX = logoDataUrl ? margin + 22 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Mercado Livre", textX, 14);

  if (data.companyName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(data.companyName, textX, 22);
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: Últimos ${data.periodLabel}`, textX, data.companyName ? 30 : 24);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, textX, data.companyName ? 36 : 30);
  y = 52;

  // --- KPIs ---
  doc.setTextColor(30, 30, 45);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Financeiros", margin, y);
  y += 8;

  const kpis = [
    ["Receita Bruta", fmt(data.grossRevenue)],
    ["Comissão ML", fmt(data.totalFees)],
    ["Custo de Frete", fmt(data.totalShipping)],
    ["Lucro Líquido", fmt(data.netRevenue)],
    ["Margem de Lucro", `${data.margin.toFixed(1)}%`],
    ["Ticket Médio", fmt(data.avgTicket)],
    ["Total de Pedidos", String(data.totalOrders)],
    ["Tendência Receita", `${data.revenueTrend >= 0 ? "+" : ""}${data.revenueTrend}%`],
  ];

  const kpiColW = (pageW - margin * 2) / 2;
  doc.setFontSize(10);
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * kpiColW;
    const ky = y + row * 12;

    // Background box
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, ky - 4, kpiColW - 4, 10, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 120);
    doc.text(kpis[i][0], x + 3, ky + 2);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 45);
    doc.text(kpis[i][1], x + kpiColW - 7, ky + 2, { align: "right" });
  }
  y += Math.ceil(kpis.length / 2) * 12 + 8;

  // --- Daily Revenue Table ---
  doc.setTextColor(30, 30, 45);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Receita Diária", margin, y);
  y += 4;

  const dailyRows = data.dailyData
    .filter((d) => d.receita > 0 || d.comissao > 0 || d.frete > 0)
    .map((d) => [d.label, fmt(d.receita), fmt(d.comissao), fmt(d.frete), fmt(d.receita - d.comissao - d.frete)]);

  if (dailyRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Receita", "Comissão", "Frete", "Líquido"]],
      body: dailyRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 45], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text("Sem dados de receita diária no período.", margin, y + 6);
    y += 14;
  }

  // --- Top Products ---
  if (data.topProducts.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = margin;
    }

    doc.setTextColor(30, 30, 45);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Performance por Produto", margin, y);
    y += 4;

    const totalRev = data.grossRevenue || 1;
    const productRows = data.topProducts.map((p, i) => [
      String(i + 1),
      p.title.length > 45 ? p.title.slice(0, 45) + "…" : p.title,
      fmt(p.revenue),
      String(p.qty),
      fmt(p.qty > 0 ? p.revenue / p.qty : 0),
      `${((p.revenue / totalRev) * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Produto", "Receita", "Qtd", "Ticket", "% Receita"]],
      body: productRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 45], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 65 },
        2: { halign: "right" },
        3: { halign: "center", cellWidth: 15 },
        4: { halign: "right" },
        5: { halign: "right", cellWidth: 22 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Order & Shipping Status ---
  const statusEntries = Object.entries(data.statusCounts);
  const shippingEntries = Object.entries(data.shippingStatusCounts);

  if (statusEntries.length > 0 || shippingEntries.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    doc.setTextColor(30, 30, 45);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Status dos Pedidos", margin, y);
    y += 4;

    if (statusEntries.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Status do Pedido", "Quantidade"]],
        body: statusEntries.map(([s, c]) => [s, String(c)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 45], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: { 1: { halign: "center", cellWidth: 30 } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (shippingEntries.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Status de Envio", "Quantidade"]],
        body: shippingEntries.map(([s, c]) => [s, String(c)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 80], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: { 1: { halign: "center", cellWidth: 30 } },
      });
    }
  }

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
    doc.text("Relatório gerado automaticamente pelo ERP", margin, pageH - 8);
  }

  // Save
  const filename = `relatorio-ml-${data.periodLabel.replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
