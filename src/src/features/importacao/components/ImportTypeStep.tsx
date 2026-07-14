import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Database, Boxes } from "lucide-react";
import { ImportType } from "../types/import-types";

interface Props {
  onSelect: (type: ImportType) => void;
}

export const ImportTypeStep = ({ onSelect }: Props) => {
  const options = [
    {
      id: 'products' as ImportType,
      title: 'Apenas Cadastro de Produtos',
      description: 'Importe nomes, SKUs, EANs, categorias, marcas e preços.',
      icon: Package
    },
    {
      id: 'stock' as ImportType,
      title: 'Apenas Saldo de Estoque',
      description: 'Atualize as quantidades em estoque de produtos já existentes.',
      icon: Database
    },
    {
      id: 'products_and_stock' as ImportType,
      title: 'Cadastro + Estoque Inicial',
      description: 'Crie os produtos e já defina o saldo inicial de estoque.',
      icon: Boxes
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((option) => (
        <Card 
          key={option.id} 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => onSelect(option.id)}
        >
          <CardHeader>
            <option.icon className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-lg">{option.title}</CardTitle>
            <CardDescription>{option.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};
