import { ImportWizard } from "@/features/importacao/components/ImportWizard";
import { Button } from "@/components/ui/button";
import { History, PlusCircle, Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import * as XLSX from 'xlsx';

const TEMPLATE_DATA = [
  {
    nome: "Produto Exemplo 1",
    sku: "SKU001",
    ean: "7890000000001",
    categoria: "Categoria Exemplo",
    marca: "Marca Exemplo",
    custo: "10,50",
    preco: "19,90",
    quantidade: "25",
    unidade: "UN",
    descricao: "Produto demonstrativo",
    ativo: "sim"
  }
];

export default function Importacao() {
  const [showWizard, setShowWizard] = useState(false);

  const handleDownloadXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_DATA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo-importacao-produtos.xlsx");
  };

  const handleDownloadCSV = () => {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_DATA);
    // Usando SheetJS para gerar o CSV com separador ;
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    // Adicionando BOM UTF-8 para garantir compatibilidade com Excel
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo-importacao-produtos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (showWizard) {
    return <ImportWizard />;
  }

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-base font-semibold leading-tight">Migração de cadastro e estoque</h1>
          <p className="text-xs text-muted-foreground">Importação de produtos e saldo inicial</p>
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowWizard(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova importação
        </Button>
      </div>

      <div className="space-y-3">
        <div className="border border-border bg-card p-3">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico recente
          </h2>
          <div className="border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Nenhuma importação ainda. Use “Nova importação” para começar.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 border border-border bg-card p-3">
            <h3 className="text-sm font-semibold">Como funciona</h3>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              {[
                "Escolha o tipo de importação (apenas produtos, ou produtos + estoque).",
                "Faça o upload do arquivo CSV ou Excel.",
                "Mapeie as colunas do arquivo com os campos do sistema.",
                "Valide os dados e confirme a importação.",
              ].map((txt, i) => (
                <li key={i} className="flex gap-2">
                  <span className="qty shrink-0 text-primary">{i + 1}.</span>
                  {txt}
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-2 border border-border bg-card p-3">
            <h3 className="text-sm font-semibold">Modelos de importação</h3>
            <p className="text-xs text-muted-foreground">
              Use estas planilhas como base. O sistema aceita <span className="code">.csv</span>,{" "}
              <span className="code">.xlsx</span> e <span className="code">.xls</span>.
            </p>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button variant="outline" size="sm" onClick={handleDownloadXLSX} className="h-8 flex-1">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Planilha modelo (XLSX)
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="h-8 flex-1">
                <Download className="mr-2 h-4 w-4" />
                Modelo CSV
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

