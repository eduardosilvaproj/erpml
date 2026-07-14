import { useState, useMemo } from 'react';
import { ImportJob, ImportJobRow, ImportType, SourceFormat, ColumnMapping, MAPPABLE_FIELDS } from '../types/import-types';
import { parseCSV } from '../services/csvParser';
import { parseXLSX } from '../services/xlsxParser';
import { parsePDF } from '../services/pdfImportParser';
import { suggestMapping } from '../utils/mapping';
import { validateRows } from '../services/importValidators';
import { executeImport, ExecutionResult } from '../services/importExecutor';
import { useCompanyId } from '@/hooks/useCompanyId';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type Step = 'type' | 'upload' | 'mapping' | 'validation' | 'preview' | 'confirm' | 'result';

export const useImportWizard = () => {
  const [currentStep, setCurrentStep] = useState<Step>('type');
  const [importType, setImportType] = useState<ImportType>('products');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const companyId = useCompanyId();
  const { toast } = useToast();

  const handleSetImportType = (type: ImportType) => {
    setImportType(type);
    setCurrentStep('upload');
  };

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    try {
      let data: any[] = [];
      const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
      
      console.log(`Iniciando parsing do arquivo: ${uploadedFile.name} (${extension})`);
      
      if (extension === 'csv') {
        data = await parseCSV(uploadedFile);
      } else if (extension === 'xlsx' || extension === 'xls') {
        data = await parseXLSX(uploadedFile);
      } else if (extension === 'pdf') {
        data = await parsePDF(uploadedFile);
      } else {
        throw new Error("Formato de arquivo não suportado. Use CSV, XLSX, XLS ou PDF.");
      }
      
      if (!data || data.length === 0) {
        throw new Error("O arquivo está vazio ou não possui linhas de dados.");
      }

      console.log(`Dados extraídos: ${data.length} linhas`);
      
      // Validação robusta de cabeçalhos
      const firstRow = data[0];
      if (!firstRow || typeof firstRow !== 'object') {
        throw new Error("Não foi possível identificar as colunas do arquivo.");
      }

      // Filtra chaves vazias ou inválidas que podem vir de parsers
      const headers = Object.keys(firstRow).filter(h => h && h.trim() !== "");
      
      if (headers.length === 0) {
        throw new Error("O arquivo não possui colunas identificáveis.");
      }

      console.log("Cabeçalhos detectados:", headers);
      
      // Limpa os dados removendo propriedades com nomes de colunas vazias
      const cleanedData = data.map(row => {
        const newRow: any = {};
        headers.forEach(h => {
          newRow[h] = row[h];
        });
        return newRow;
      });

      setRawRows(cleanedData);
      
      const suggested = suggestMapping(headers);
      console.log("Mapeamento sugerido:", suggested);
      setMappings(suggested);
      
      setCurrentStep('mapping');
    } catch (error: any) {
      console.error("Erro detalhado no processamento:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: error.message || "Não foi possível processar o arquivo enviado.",
        variant: "destructive"
      });
      setFile(null);
    }
  };

  const handleUpdateMapping = (internalField: string, externalField: string) => {
    setMappings(prev => {
      const filtered = prev.filter(m => m.internalField !== internalField);
      if (!externalField) return filtered;
      return [...filtered, { internalField, externalField }];
    });
  };

  const validatedRows = useMemo(() => {
    if (rawRows.length === 0 || mappings.length === 0) return [];
    return validateRows(rawRows, mappings, importType);
  }, [rawRows, mappings, importType]);

  const stats = useMemo(() => {
    const total = validatedRows.length;
    const errors = validatedRows.filter(r => (r.validation_errors?.length ?? 0) > 0).length;
    return { total, errors, valid: total - errors };
  }, [validatedRows]);

  const handleStartImport = async () => {
    if (!companyId) return;
    setIsProcessing(true);
    setProgress(0);
    try {
      const res = await executeImport(validatedRows, importType, companyId, (current, total) => {
        setProgress(Math.round((current / total) * 100));
      });
      setResult(res);
      setCurrentStep('result');
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: "Ocorreu um problema ao processar os dados.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    importType,
    handleSetImportType,
    handleFileUpload,
    file,
    rawRows,
    mappings,
    handleUpdateMapping,
    validatedRows,
    stats,
    handleStartImport,
    isProcessing,
    progress,
    result,
    MAPPABLE_FIELDS
  };
};
