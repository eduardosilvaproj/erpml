import { ImportTypeStep } from "./ImportTypeStep";
import { ImportUploadStep } from "./ImportUploadStep";
import { ImportMappingStep } from "./ImportMappingStep";
import { useImportWizard } from "../hooks/useImportWizard";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, LayoutGrid } from "lucide-react";

const STEPS = [
  { id: 'type', label: 'Tipo' },
  { id: 'upload', label: 'Arquivo' },
  { id: 'mapping', label: 'Mapeamento' },
  { id: 'validation', label: 'Validação' },
  { id: 'preview', label: 'Preview' },
  { id: 'confirm', label: 'Confirmar' }
];

export const ImportWizard = () => {
  const wizard = useImportWizard();

  const currentStepIndex = STEPS.findIndex(s => s.id === wizard.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const headers = (wizard.rawRows.length > 0 && wizard.rawRows[0] && typeof wizard.rawRows[0] === 'object') 
    ? Object.keys(wizard.rawRows[0]) 
    : [];

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Migração de Cadastro e Estoque</h1>
        <p className="text-muted-foreground">Importe seus produtos e saldo inicial de forma rápida e segura.</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          {STEPS.map((step, idx) => (
            <div 
              key={step.id} 
              className={`flex flex-col items-center gap-1 ${idx > currentStepIndex ? 'opacity-40' : ''}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                idx <= currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {idx + 1}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {STEPS[currentStepIndex]?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wizard.currentStep === 'type' && (
            <ImportTypeStep onSelect={wizard.handleSetImportType} />
          )}
          
          {wizard.currentStep === 'upload' && (
            <ImportUploadStep onUpload={wizard.handleFileUpload} />
          )}

          {wizard.currentStep === 'mapping' && (
            <ImportMappingStep 
              headers={headers}
              mappings={wizard.mappings}
              onUpdateMapping={wizard.handleUpdateMapping}
              onNext={() => wizard.setCurrentStep('validation')}
              onBack={() => wizard.setCurrentStep('upload')}
            />
          )}

          {wizard.currentStep === 'validation' && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total</span>
                    </div>
                    <div className="text-2xl font-bold mt-2">{wizard.stats.total}</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Válidas</span>
                    </div>
                    <div className="text-2xl font-bold mt-2 text-green-700">{wizard.stats.valid}</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-900">Com Erro</span>
                    </div>
                    <div className="text-2xl font-bold mt-2 text-red-700">{wizard.stats.errors}</div>
                  </CardContent>
                </Card>
              </div>

              <ImportPreviewTable 
                rows={wizard.validatedRows} 
                mappings={wizard.mappings} 
              />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => wizard.setCurrentStep('mapping')}>Voltar</Button>
                <Button 
                  disabled={wizard.stats.valid === 0}
                  onClick={() => wizard.setCurrentStep('confirm')}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {wizard.currentStep === 'confirm' && (
            <div className="py-12 text-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Confirmar Importação</h3>
                <p className="text-muted-foreground">
                  Você está prestes a importar {wizard.stats.valid} produtos/saldos para o sistema.
                </p>
              </div>

              {wizard.isProcessing ? (
                <div className="max-w-md mx-auto space-y-4">
                  <Progress value={wizard.progress} className="h-2" />
                  <p className="text-sm font-medium">Processando... {wizard.progress}%</p>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => wizard.setCurrentStep('validation')}>Voltar</Button>
                  <Button size="lg" onClick={wizard.handleStartImport}>Iniciar Importação Agora</Button>
                </div>
              )}
            </div>
          )}

          {wizard.currentStep === 'result' && wizard.result && (
            <div className="py-12 text-center space-y-8">
              <div className="flex justify-center">
                <div className={`h-16 w-16 ${wizard.result.failed === 0 ? 'bg-green-100' : (wizard.result.created + wizard.result.updated > 0 ? 'bg-amber-100' : 'bg-red-100')} rounded-full flex items-center justify-center`}>
                  {wizard.result.failed === 0 ? (
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  ) : (
                    <AlertCircle className={`h-10 w-10 ${wizard.result.created + wizard.result.updated > 0 ? 'text-amber-600' : 'text-red-600'}`} />
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">
                  {wizard.result.failed === 0 
                    ? 'Importação Concluída!' 
                    : (wizard.result.created + wizard.result.updated > 0 ? 'Importação Concluída com Alertas' : 'Falha na Importação')}
                </h3>
                <p className="text-muted-foreground">
                  {wizard.result.failed === 0 
                    ? 'Todos os registros foram processados com sucesso.' 
                    : `Processamento finalizado com ${wizard.result.failed} erro(s).`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{wizard.result.created}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Criados</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{wizard.result.updated}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Atualizados</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{wizard.result.failed}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Falhas</div>
                  </CardContent>
                </Card>
              </div>

              {wizard.result.errors.length > 0 && (
                <div className="max-w-2xl mx-auto text-left bg-red-50 p-4 rounded-lg border border-red-100 max-h-60 overflow-y-auto">
                  <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Detalhes das falhas:
                  </h4>
                  <ul className="text-sm space-y-1 text-red-700">
                    {wizard.result.errors.slice(0, 50).map((err, i) => (
                      <li key={i}>
                        <strong>Linha {err.row}:</strong> {err.message}
                      </li>
                    ))}
                    {wizard.result.errors.length > 50 && (
                      <li className="italic">...e mais {wizard.result.errors.length - 50} erros.</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button onClick={() => window.location.href = '/produtos'}>Ver Produtos</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>Nova Importação</Button>
              </div>
            </div>
          )}

          {['preview'].includes(wizard.currentStep) && (
            <div className="py-12 text-center space-y-4">
              <p>Etapa {wizard.currentStep} em desenvolvimento.</p>
              <Button onClick={() => wizard.setCurrentStep('type')}>Recomeçar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
