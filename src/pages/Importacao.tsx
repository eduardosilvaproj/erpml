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
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Migração de Cadastro e Estoque</h1>
          <p className="text-muted-foreground">Importe seus produtos e saldo inicial de forma rápida e segura.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowWizard(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Importação
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico Recente
          </h2>
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-md border border-dashed">
            Nenhuma importação encontrada. Inicie uma nova importação acima.
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">Como funciona?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                Escolha o tipo de importação (Apenas Produtos ou Produtos + Estoque).
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                Faça o upload do seu arquivo CSV ou Excel.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                Mapeie as colunas do seu arquivo com os campos do sistema.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                Valide os dados e confirme a importação.
              </li>
            </ul>
          </div>
          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Modelos de Importação</h3>
            <p className="text-sm text-muted-foreground">
              Use estas planilhas como base para importar seus produtos e estoque.
              O sistema aceita arquivos <strong>.csv</strong>, <strong>.xlsx</strong> e <strong>.xls</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={handleDownloadXLSX} className="flex-1">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Baixar Planilha Modelo (XLSX)
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="flex-1">
                <Download className="mr-2 h-4 w-4 text-blue-600" />
                Baixar Modelo CSV
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

