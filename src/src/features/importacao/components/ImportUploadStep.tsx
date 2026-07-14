import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  onUpload: (file: File) => void;
}

export const ImportUploadStep = ({ onUpload }: Props) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setSelectedFile(acceptedFiles[0]);
    },
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const isPDF = selectedFile?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Arraste ou clique para selecionar</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Formatos aceitos: CSV, XLSX, XLS e PDF
        </p>
      </div>

      {selectedFile && (
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPDF ? <FileText className="h-6 w-6" /> : <FileSpreadsheet className="h-6 w-6" />}
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button onClick={() => onUpload(selectedFile)}>Continuar</Button>
        </Card>
      )}

      {isPDF && (
        <Alert className="border-orange-500 bg-orange-50 text-orange-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            PDF é um formato de menor confiabilidade para migração. 
            Revise os dados cuidadosamente antes de confirmar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
