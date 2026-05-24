import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  Bug, 
  Activity, 
  History, 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Database,
  Lock,
  Globe,
  Terminal,
  FileSearch,
  Zap,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  User,
  MessageSquare,
  Calendar,
  Eye,
  Settings,
  MoreVertical,
  UserPlus,
  Save,
  Pencil,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Trash2,
  Loader2,
  Maximize2,
  ExternalLink,
  Printer,
  BarChart3,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsInbox } from "@/components/admin/NotificationsInbox";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  PieChart,
  Pie
} from 'recharts';



import { 
  useTestErrorReports, 
  useCreateTestErrorReport, 
  useUpdateTestErrorReport, 
  useErrorReportsMetrics,
  useErrorReportDetails,
  useAddErrorComment,
  useAdminTeam,
  TestErrorReport,
  ErrorReportsFilter,
  TechnicalComment,
  ActivityLog
} from "@/hooks/useTestErrorReports";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";

import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";


export default function AdminMasterDevPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-synced filter state
  const [filters, setFilters] = useState<ErrorReportsFilter>({
    severity: searchParams.get('severity') || 'all',
    environment: searchParams.get('environment') || 'all',
    status: searchParams.get('status') || 'all',
    assigned_to: searchParams.get('assigned_to') || 'all',
    validator_id: searchParams.get('validator_id') || 'all',
    search: searchParams.get('search') || '',
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: 10,
    orderBy: searchParams.get('orderBy') || 'created_at',
    orderDirection: (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc',
  });

  const { data: reportsResponse, isLoading: loadingReports } = useTestErrorReports(filters);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30' | 'all'>('all');
  const analyticsRef = useRef<HTMLDivElement>(null);


  const { data: metrics } = useErrorReportsMetrics();
  const { data: systemStatus } = useSystemStatus();
  const { data: adminTeam } = useAdminTeam();
  const createReport = useCreateTestErrorReport();
  const updateReport = useUpdateTestErrorReport();
  const addComment = useAddErrorComment();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { data: details, isLoading: loadingDetails } = useErrorReportDetails(selectedReportId || "");
  
  const [commentText, setCommentText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Editable fields in drawer
  const [isEditingTechnical, setIsEditingTechnical] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TestErrorReport>>({});

  useEffect(() => {
    if (details?.report) {
      setEditForm({
        expected_behavior: details.report.expected_behavior,
        observed_behavior: details.report.observed_behavior,
        reproduction_steps: details.report.reproduction_steps,
        root_cause_notes: details.report.root_cause_notes,
        fix_scope: details.report.fix_scope,
        systemic_impact: details.report.systemic_impact,
        blocker_reason: details.report.blocker_reason,
        resolution_summary: details.report.resolution_summary,
        validation_notes: details.report.validation_notes,
      });
    }
  }, [details]);

  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    module: "",
    route: "",
    severity: "medium" as const,
    environment: "production" as const,
    reproduction_steps: "",
    expected_behavior: "",
    observed_behavior: "",
    assigned_to: null as string | null,
    validator_id: null as string | null,
    blocker_reason: "",
    resolution_summary: "",
    validation_notes: "",
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
    if (filters.environment && filters.environment !== 'all') params.set('environment', filters.environment);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.assigned_to && filters.assigned_to !== 'all') params.set('assigned_to', filters.assigned_to);
    if (filters.validator_id && filters.validator_id !== 'all') params.set('validator_id', filters.validator_id);
    if (filters.search) params.set('search', filters.search);
    if (filters.page && filters.page > 1) params.set('page', filters.page.toString());
    if (filters.orderBy && filters.orderBy !== 'created_at') params.set('orderBy', filters.orderBy);
    if (filters.orderDirection && filters.orderDirection !== 'desc') params.set('orderDirection', filters.orderDirection);
    
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const updateFilter = (newFilters: Partial<ErrorReportsFilter>) => {
    setFilters(prev => ({ 
      ...prev, 
      ...newFilters, 
      page: newFilters.page !== undefined ? newFilters.page : 1 
    }));
  };


  const clearFilters = () => {
    setFilters({
      severity: 'all',
      environment: 'all',
      status: 'all',
      assigned_to: 'all',
      validator_id: 'all',
      search: '',
      page: 1,
      pageSize: 10,
      orderBy: 'created_at',
      orderDirection: 'desc',
    });
  };

  const toggleSort = (field: string) => {
    const isSameField = filters.orderBy === field;
    const direction = isSameField && filters.orderDirection === 'desc' ? 'asc' : 'desc';
    updateFilter({ orderBy: field, orderDirection: direction });
  };

  const handleCreateReport = async () => {
    if (!newReport.title || !newReport.description || !newReport.module) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      await createReport.mutateAsync({
        ...newReport,
        status: "open",
        reported_by: user!.id,
        last_updated_by: user!.id,
        root_cause_notes: null,
        fix_scope: null,
        systemic_impact: null,
        validator_id: null,
        blocker_reason: null,
        resolution_summary: null,
        validation_notes: null,
      });
      toast.success("Erro de teste registrado!");
      setIsCreateDialogOpen(false);
      setNewReport({
        title: "",
        description: "",
        module: "",
        route: "",
        severity: "medium",
        environment: "production",
        reproduction_steps: "",
        expected_behavior: "",
        observed_behavior: "",
        assigned_to: null,
        validator_id: null,
        blocker_reason: "",
        resolution_summary: "",
        validation_notes: "",
      });
    } catch (error: any) {
      toast.error("Erro ao registrar: " + error.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: TestErrorReport['status'], oldStatus?: string) => {
    try {
      await updateReport.mutateAsync({ 
        id, 
        updates: { status }, 
        userId: user!.id,
        audit: oldStatus ? [{ field: 'status', old: oldStatus, new: status }] : []
      });
      toast.success("Status atualizado");
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const handleAssignTo = async (id: string, userId: string | null, oldUserId?: string | null) => {
    try {
      await updateReport.mutateAsync({
        id,
        updates: { assigned_to: userId },
        userId: user!.id,
        audit: [{ field: 'assigned_to', old: oldUserId || null, new: userId }]
      });
      toast.success(userId ? "Responsável atribuído" : "Responsável removido");
    } catch (error: any) {
      toast.error("Erro ao atribuir: " + error.message);
    }
  };

  const handleAssignValidator = async (id: string, userId: string | null, oldUserId?: string | null) => {
    try {
      await updateReport.mutateAsync({
        id,
        updates: { validator_id: userId },
        userId: user!.id,
        audit: [{ field: 'validator_id', old: oldUserId || null, new: userId }]
      });
      toast.success(userId ? "Validador atribuído" : "Validador removido");
    } catch (error: any) {
      toast.error("Erro ao atribuir validador: " + error.message);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedReportId) return;
    try {
      await addComment.mutateAsync({ 
        reportId: selectedReportId, 
        userId: user!.id, 
        content: commentText,
        attachments: attachments
      });
      setCommentText("");
      setAttachments([]);
      toast.success("Comentário adicionado");
    } catch (error: any) {
      toast.error("Erro ao comentar: " + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter by size
    const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
    if (validFiles.length < files.length) {
      toast.error("Alguns arquivos excederam o limite de 5MB e foram ignorados");
    }
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    let completed = 0;
    const uploadedUrls: string[] = [];

    for (const file of validFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedReportId}/${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('test_error_attachments')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('test_error_attachments')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
        completed++;
        setUploadProgress((completed / validFiles.length) * 100);
      } catch (error: any) {
        toast.error(`Falha no upload de ${file.name}: ${error.message}`);
      }
    }

    if (uploadedUrls.length > 0) {
      setAttachments(prev => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} arquivo(s) anexado(s)`);
    }

    setIsUploading(false);
    setTimeout(() => setUploadProgress(0), 1000);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const handleSaveTechnical = async () => {
    if (!selectedReportId || !details?.report) return;
    
    const audit: { field: string, old: string | null, new: string | null }[] = [];
    const fields = ['expected_behavior', 'observed_behavior', 'reproduction_steps', 'root_cause_notes', 'fix_scope', 'systemic_impact', 'blocker_reason', 'resolution_summary', 'validation_notes'] as const;
    
    const updates: Partial<TestErrorReport> = {};
    fields.forEach(f => {
      if (editForm[f] !== details.report[f]) {
        updates[f] = editForm[f] as any;
        audit.push({ field: f, old: details.report[f] || null, new: (editForm[f] as string) || null });
      }
    });

    if (audit.length === 0) {
      setIsEditingTechnical(false);
      return;
    }

    try {
      await updateReport.mutateAsync({
        id: selectedReportId,
        updates,
        userId: user!.id,
        audit // Frontend-side audit is still kept for immediate context, but DB now has its own trigger
      });
      setIsEditingTechnical(false);
      toast.success("Dados técnicos atualizados");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };


  const exportAnalyticsToCSV = () => {
    if (!metrics?.rawData) return;
    
    const headers = ["ID", "Título", "Módulo", "Severidade", "Status", "SLA Status", "MTTR (h)", "Criado em", "Resolvido em"];
    const rows = metrics.rawData.map(r => [
      r.id,
      r.title,
      r.module,
      r.severity,
      r.status,
      r.sla_status,
      r.resolved_at ? differenceInHours(new Date(r.resolved_at), new Date(r.created_at)) : "N/A",
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
      r.resolved_at ? format(new Date(r.resolved_at), 'yyyy-MM-dd HH:mm') : "N/A"
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `test_analytics_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAutomationAlerts = useCallback(() => {
    if (!metrics) return;
    
    // Auto-suggest alerts based on metrics
    if (metrics.stale > 0) {
      toast.warning(`${metrics.stale} itens parados sem atualização há mais de 48h.`, {
        description: "Considere cobrar um update dos responsáveis.",
        duration: 5000,
      });
    }
    
    if (metrics.blocked > 0) {
      toast.error(`${metrics.blocked} itens bloqueados detectados no workflow.`, {
        description: "Verifique os motivos de bloqueio no painel.",
        duration: 5000,
      });
    }

    const imminentOverdue = metrics.rawData.filter(r => {
      if (r.status === 'resolved' || r.status === 'closed') return false;
      const { remaining } = calculateSLA(r as any);
      return remaining > 0 && remaining <= 2; // Less than 2 hours remaining
    }).length;

    if (imminentOverdue > 0) {
      toast.error(`${imminentOverdue} incidentes prestes a vencer o SLA (< 2h).`, {
        description: "Prioridade máxima sugerida.",
        duration: 6000,
      });
    }

    const unassignedReady = metrics.rawData.filter(r => r.status === 'ready_for_validation' && !r.validator_id).length;
    if (unassignedReady > 0) {
      toast.info(`${unassignedReady} itens prontos para validação sem QA atribuído.`, {
        description: "Atribua um validador para evitar gargalo.",
        duration: 5000,
      });
    }
  }, [metrics]);

  useEffect(() => {
    if (metrics) {
      const timer = setTimeout(() => {
        handleAutomationAlerts();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [metrics, handleAutomationAlerts]);

  const calculateSLA = (report: TestErrorReport) => {
    if (report.status === 'resolved' || report.status === 'closed') return { status: 'normal', remaining: 0 };
    
    const SLA_CONFIG = {
      critical: 4,
      high: 24,
      medium: 72,
      low: 168
    };

    const limit = SLA_CONFIG[report.severity] || 72;
    const elapsed = differenceInHours(new Date(), new Date(report.created_at));
    const remaining = limit - elapsed;

    let status = 'normal';
    if (remaining <= 0) status = 'overdue';
    else if (remaining <= limit * 0.25) status = 'warning';

    return { status, remaining, elapsed, limit };
  };

  const exportToCSV = () => {
    if (!reportsResponse?.data) return;
    
    const headers = [
      "Título", 
      "Módulo", 
      "Severidade", 
      "Status", 
      "Ambiente", 
      "Owner", 
      "Validator",
      "SLA Status",
      "Criado em",
      "Triado em",
      "Início Execução",
      "Pronto p/ Validação",
      "Resolvido em",
      "Fechado em",
      "Motivo Bloqueio",
      "Resumo Resolução"
    ];

    const rows = reportsResponse.data.map(r => [
      r.title,
      r.module,
      r.severity,
      r.status,
      r.environment,
      r.assigned_to_profile?.full_name || "N/A",
      r.validator_profile?.full_name || "N/A",
      r.sla_status,
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      r.triaged_at ? format(new Date(r.triaged_at), 'dd/MM/yyyy HH:mm') : "—",
      r.in_progress_at ? format(new Date(r.in_progress_at), 'dd/MM/yyyy HH:mm') : "—",
      r.ready_for_validation_at ? format(new Date(r.ready_for_validation_at), 'dd/MM/yyyy HH:mm') : "—",
      r.resolved_at ? format(new Date(r.resolved_at), 'dd/MM/yyyy HH:mm') : "—",
      r.closed_at ? format(new Date(r.closed_at), 'dd/MM/yyyy HH:mm') : "—",
      r.blocker_reason || "",
      r.resolution_summary || ""
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `exec_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCSVOld = () => {

    if (!reportsResponse?.data) return;
    
    const headers = ["Título", "Módulo", "Severidade", "Status", "Ambiente", "Responsável", "Criado em"];
    const rows = reportsResponse.data.map(r => [
      r.title,
      r.module,
      r.severity,
      r.status,
      r.environment,
      r.assigned_to_profile?.full_name || "Não atribuído",
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `test_errors_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'open': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'blocked': return <Lock className="h-4 w-4 text-orange-600" />;
      case 'ready_for_validation': return <Eye className="h-4 w-4 text-purple-500" />;
      case 'closed': return <ShieldCheck className="h-4 w-4 text-gray-500" />;
      default: return <History className="h-4 w-4 text-gray-500" />;
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Master (Dev)</h1>
          <p className="text-muted-foreground">Painel de Controle Stovix / Governança, QA e Status do Sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 hidden sm:flex">
            <Terminal className="h-3 w-3 mr-2" />
            Ambiente: {import.meta.env.MODE}
          </Badge>
          
          <NotificationsInbox onNavigateToError={(id) => setSelectedReportId(id)} />

          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <PlusCircle className="h-4 w-4 mr-2" />
            Registrar Erro
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Erros</CardTitle>
            <Bug className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Registros históricos</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => updateFilter({ status: 'open', severity: 'critical' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos Abertos</CardTitle>
            <ShieldCheck className="h-4 w-4 text-red-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.critical || 0}</div>
            <p className="text-xs text-muted-foreground">Requer atenção imediata</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => updateFilter({ sla_status: 'overdue' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Vencido</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.overdue || 0}</div>
            <p className="text-xs text-muted-foreground">Fora do prazo</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => updateFilter({ assigned_to: 'unassigned' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Responsável</CardTitle>
            <UserPlus className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.unassigned || 0}</div>
            <p className="text-xs text-muted-foreground">Aguardando atribuição</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => {
            toast.info("Filtrando itens sem atualização...");
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estagnados (&gt;48h)</CardTitle>
            <History className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.stale || 0}</div>
            <p className="text-xs text-muted-foreground">Sem atualização recente</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTTR Médio</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics?.avgResolutionTime || 0)}h</div>
            <p className="text-xs text-muted-foreground">Tempo de resolução</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => updateFilter({ status: 'blocked' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqueados</CardTitle>
            <Lock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blocked || 0}</div>
            <p className="text-xs text-muted-foreground">Dependências externas</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02]"
          onClick={() => updateFilter({ status: 'ready_for_validation' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando QA</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.readyForValidation || 0}</div>
            <p className="text-xs text-muted-foreground">Pronto p/ validação</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="qa" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-4">
          <TabsTrigger value="governance">Governança</TabsTrigger>
          <TabsTrigger value="qa">QA / Erros</TabsTrigger>
          <TabsTrigger value="system">Status</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>


        <TabsContent value="governance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Visão Operacional
                </CardTitle>
                <CardDescription>Governança técnica e alertas internos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-primary/5 space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" /> Alerta Administrativo
                  </h4>
                  <p className="text-sm text-muted-foreground italic">
                    "Verificar logs de migração pendentes para o módulo de PDV no staging."
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Observações Técnicas</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    <li>Monitoramento de latência do Supabase está normalizado.</li>
                    <li>Nova role `admin_master_dev` implementada e testada.</li>
                    <li>Políticas de RLS auditadas para `test_error_reports`.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" />
                  Status Administrativo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">Controle de Acesso</span>
                    <Badge variant="outline">Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">Auditoria de QA</span>
                    <Badge variant="outline">Em dia</Badge>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm">Integridade de Dados</span>
                    <Badge variant="outline" className="text-green-500">100%</Badge>
                  </div>
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
                    <h4 className="text-xs font-bold text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" /> Alertas Executivos
                    </h4>
                    <ul className="text-[10px] space-y-1 text-red-700">
                      {metrics?.overdue && metrics.overdue > 0 ? (
                        <li className="flex items-center gap-1">• {metrics.overdue} itens com SLA vencido</li>
                      ) : null}
                      {metrics?.blocked && metrics.blocked > 0 ? (
                        <li className="flex items-center gap-1">• {metrics.blocked} incidentes bloqueados</li>
                      ) : null}
                      {metrics?.stale && metrics.stale > 0 ? (
                        <li className="flex items-center gap-1">• {metrics.stale} itens sem atualização &gt; 48h</li>
                      ) : null}
                      {metrics?.unassigned && metrics.unassigned > 0 ? (
                        <li className="flex items-center gap-1">• {metrics.unassigned} itens sem responsável</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="qa" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Registro de Erros de Teste</CardTitle>
                  <CardDescription>Acompanhamento técnico de bugs e instabilidades</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por título ou módulo..."
                      className="pl-9"
                      value={filters.search}
                      onChange={(e) => updateFilter({ search: e.target.value })}
                    />
                    {filters.search && (
                      <button 
                        onClick={() => updateFilter({ search: '' })}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <Select 
                    value={filters.status} 
                    onValueChange={(val) => updateFilter({ status: val })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="triaged">Triado</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="wont_fix">Não Corrigir</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={filters.validator_id} 
                    onValueChange={(val) => updateFilter({ validator_id: val })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Validador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer validador</SelectItem>
                      <SelectItem value="unassigned">Sem validador</SelectItem>
                      {adminTeam?.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuário'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={filters.severity} 
                    onValueChange={(val) => updateFilter({ severity: val })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Severidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Severidades</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={filters.assigned_to} 
                    onValueChange={(val) => updateFilter({ assigned_to: val })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer pessoa</SelectItem>
                      <SelectItem value="unassigned">Não atribuído</SelectItem>
                      {adminTeam?.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuário'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="icon" onClick={exportToCSV} title="Exportar CSV">
                    <Download className="h-4 w-4" />
                  </Button>

                  {(filters.status !== 'all' || filters.severity !== 'all' || filters.environment !== 'all' || filters.assigned_to !== 'all' || filters.search) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('title')}
                      >
                        <div className="flex items-center gap-2">
                          Título
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('module')}
                      >
                        <div className="flex items-center gap-2">
                          Módulo
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('severity')}
                      >
                        <div className="flex items-center gap-2">
                          Severidade
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('created_at')}
                      >
                        <div className="flex items-center gap-2">
                          Data
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingReports ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
                    ) : !reportsResponse?.data || reportsResponse.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Bug className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-muted-foreground">Nenhum erro encontrado com os filtros atuais.</p>
                            <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportsResponse.data.map((report) => (
                        <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedReportId(report.id)}>
                          <TableCell>{getStatusIcon(report.status)}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{report.title}</TableCell>
                          <TableCell><Badge variant="outline">{report.module}</Badge></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getSeverityColor(report.severity)}>
                              {report.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {report.assigned_to_profile ? (
                                <>
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={report.assigned_to_profile.avatar_url} />
                                    <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs truncate max-w-[80px]">{report.assigned_to_profile.full_name}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(report.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Select 
                                defaultValue={report.status} 
                                onValueChange={(val) => handleUpdateStatus(report.id, val as any, report.status)}
                              >
                                <SelectTrigger className="h-8 w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Aberto</SelectItem>
                                  <SelectItem value="triaged">Triado</SelectItem>
                                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                                  <SelectItem value="blocked">Bloqueado</SelectItem>
                                  <SelectItem value="ready_for_validation">Pronto p/ Validação</SelectItem>
                                  <SelectItem value="resolved">Resolvido</SelectItem>
                                  <SelectItem value="closed">Fechado</SelectItem>
                                  <SelectItem value="wont_fix">Não Corrigir</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {reportsResponse && reportsResponse.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-medium">{reportsResponse.count}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={filters.page === 1}
                      onClick={() => updateFilter({ page: (filters.page || 1) - 1 })}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs">{filters.page} / {reportsResponse.totalPages}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={filters.page === reportsResponse.totalPages}
                      onClick={() => updateFilter({ page: (filters.page || 1) + 1 })}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integridade do Sistema</CardTitle>
              <CardDescription>Indicadores em tempo real dos serviços core</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Supabase</span>
                    <Badge className={systemStatus?.supabase.status === 'online' ? 'bg-green-500' : 'bg-red-500'}>
                      {systemStatus?.supabase.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    {systemStatus?.supabase.message}
                  </div>
                </div>
                <div className="p-4 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Gateway API</span>
                    <Badge className="bg-green-500">online</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    Latência: {systemStatus?.api.latency}ms
                  </div>
                </div>
                <div className="p-4 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rotas / Admin</span>
                    <Badge className="bg-green-500">online</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    Todas as rotas acessíveis
                  </div>
                </div>
                <div className="p-4 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Storage</span>
                    <Badge className="bg-green-500">online</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    Buckets S3 operacionais
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/30 p-4 rounded-xl border border-border/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Dashboard Analítico</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-muted p-1 rounded-lg">
                <Button 
                  variant={analyticsPeriod === '7d' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setAnalyticsPeriod('7d')}
                  className="h-8 text-xs"
                >
                  7 dias
                </Button>
                <Button 
                  variant={analyticsPeriod === '30' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setAnalyticsPeriod('30')}
                  className="h-8 text-xs"
                >
                  30 dias
                </Button>
                <Button 
                  variant={analyticsPeriod === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setAnalyticsPeriod('all')}
                  className="h-8 text-xs"
                >
                  Tudo
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportAnalyticsToCSV} className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>

            </div>
          </div>

          <div ref={analyticsRef} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Tendência de Incidentes
                  </CardTitle>
                  <CardDescription>Criação vs Resolução por dia</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={useMemo(() => {
                      if (!metrics?.rawData) return [];
                      const days: Record<string, { date: string, created: number, resolved: number }> = {};
                      
                      // Filter by period
                      const now = new Date();
                      const filteredData = metrics.rawData.filter(r => {
                        if (analyticsPeriod === 'all') return true;
                        const daysLimit = analyticsPeriod === '7d' ? 7 : 30;
                        const date = new Date(r.created_at);
                        const diff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
                        return diff <= daysLimit;
                      });

                      filteredData.forEach(r => {
                        const dateKey = format(new Date(r.created_at), 'dd/MM');
                        if (!days[dateKey]) days[dateKey] = { date: dateKey, created: 0, resolved: 0 };
                        days[dateKey].created++;
                        if (r.status === 'resolved' && r.resolved_at) {
                          const resDateKey = format(new Date(r.resolved_at), 'dd/MM');
                          if (!days[resDateKey]) days[resDateKey] = { date: resDateKey, created: 0, resolved: 0 };
                          days[resDateKey].resolved++;
                        }
                      });

                      return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
                    }, [metrics?.rawData, analyticsPeriod])}>
                      <defs>
                        <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                      <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="created" name="Criados" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCreated)" />
                      <Area type="monotone" dataKey="resolved" name="Resolvidos" stroke="#22c55e" fillOpacity={1} fill="url(#colorResolved)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Distribuição de Status</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Abertos', value: metrics?.statusDistribution.open || 0, color: '#ef4444' },
                          { name: 'Triados', value: metrics?.statusDistribution.triaged || 0, color: '#f59e0b' },
                          { name: 'Em Progresso', value: metrics?.statusDistribution.inProgress || 0, color: '#3b82f6' },
                          { name: 'Resolvidos', value: metrics?.statusDistribution.resolved || 0, color: '#22c55e' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { color: '#ef4444' },
                          { color: '#f59e0b' },
                          { color: '#3b82f6' },
                          { color: '#22c55e' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                      <span>Abertos: {metrics?.statusDistribution.open}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                      <span>Resolvidos: {metrics?.statusDistribution.resolved}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Incidentes por Módulo</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={Object.entries(metrics?.moduleDistribution || {}).map(([name, value]) => ({ name, value })).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                      <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    Top Severidade
                    <Badge variant="outline" className="text-[10px]">{Math.round(metrics?.avgResolutionTime || 0)}h MTTR</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(metrics?.severityDistribution || {}).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize">{key}</span>
                        <span className="font-bold">{val as number}</span>
                      </div>
                      <Progress 
                        value={metrics?.total ? (val as number / metrics.total) * 100 : 0} 
                        className={cn(
                          "h-1.5",
                          key === 'critical' ? "[&>div]:bg-red-500" :
                          key === 'high' ? "[&>div]:bg-orange-500" :
                          key === 'medium' ? "[&>div]:bg-yellow-500" :
                          "[&>div]:bg-blue-500"
                        )}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Gargalos por Etapa (SLA)</CardTitle>
                  <CardDescription>Tempo médio de permanência em horas</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { stage: 'Triagem', value: Math.round(metrics?.avgTimeByStage?.triaging || 0) },
                      { stage: 'Execução', value: Math.round(metrics?.avgTimeByStage?.execution || 0) },
                      { stage: 'Validação', value: Math.round(metrics?.avgTimeByStage?.validation || 0) },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                      <XAxis dataKey="stage" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

      </Tabs>



      {/* Details Dialog */}
      <Dialog open={!!selectedReportId} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {loadingDetails ? (
            <div className="p-12 text-center">Carregando detalhes...</div>
          ) : details && (
            <>
              <div className="p-6 border-b bg-muted/20">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getSeverityColor(details.report.severity)}>
                      {details.report.severity}
                    </Badge>
                    <Badge variant="secondary">{details.report.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      defaultValue={details.report.assigned_to || "unassigned"}
                      onValueChange={(val) => handleAssignTo(details.report.id, val === "unassigned" ? null : val, details.report.assigned_to)}
                    >
                      <SelectTrigger className="h-8 w-[160px]">
                        <UserPlus className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="Owner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sem Owner</SelectItem>
                        {adminTeam?.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select 
                      defaultValue={details.report.validator_id || "unassigned"}
                      onValueChange={(val) => handleAssignValidator(details.report.id, val === "unassigned" ? null : val, details.report.validator_id)}
                    >
                      <SelectTrigger className="h-8 w-[160px]">
                        <Eye className="h-3 w-3 mr-2" />
                        <SelectValue placeholder="Validador..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sem Validador</SelectItem>
                        {adminTeam?.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <h2 className="text-2xl font-bold">{details.report.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> {details.report.module}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(details.report.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3">
                  <div className="lg:col-span-2 p-6 space-y-8">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-primary uppercase tracking-wider text-xs">Dados Técnicos</h4>
                      <Button variant="ghost" size="sm" onClick={() => isEditingTechnical ? handleSaveTechnical() : setIsEditingTechnical(true)}>
                        {isEditingTechnical ? <Save className="h-4 w-4 mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                        {isEditingTechnical ? "Salvar" : "Editar"}
                      </Button>
                    </div>

                    <section className="space-y-2">
                      <h4 className="font-semibold text-primary uppercase tracking-wider text-[10px] opacity-70">Descrição</h4>
                      <p className="text-sm leading-relaxed">{details.report.description}</p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="space-y-2">
                        <h4 className="font-semibold text-primary uppercase tracking-wider text-[10px] opacity-70">Esperado</h4>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.expected_behavior || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, expected_behavior: e.target.value }))}
                            className="text-sm min-h-[80px]"
                          />
                        ) : (
                          <div className="p-3 bg-muted/50 rounded-lg text-sm italic">{details.report.expected_behavior || 'N/A'}</div>
                        )}
                      </section>
                      <section className="space-y-2">
                        <h4 className="font-semibold text-destructive uppercase tracking-wider text-[10px] opacity-70">Observado</h4>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.observed_behavior || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, observed_behavior: e.target.value }))}
                            className="text-sm min-h-[80px]"
                          />
                        ) : (
                          <div className="p-3 bg-destructive/5 rounded-lg text-sm font-medium border border-destructive/10">{details.report.observed_behavior || 'N/A'}</div>
                        )}
                      </section>
                    </div>

                    <section className="space-y-2">
                      <h4 className="font-semibold text-primary uppercase tracking-wider text-[10px] opacity-70">Reprodução</h4>
                      {isEditingTechnical ? (
                        <Textarea 
                          value={editForm.reproduction_steps || ""} 
                          onChange={(e) => setEditForm(prev => ({ ...prev, reproduction_steps: e.target.value }))}
                          className="text-sm font-mono min-h-[120px]"
                        />
                      ) : (
                        <pre className="p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap">{details.report.reproduction_steps || 'Sem passos registrados'}</pre>
                      )}
                    </section>

                    <section className="space-y-4 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">Notas Técnicas ({details.comments.length})</h4>
                        </div>
                        {isUploading && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Enviando... {Math.round(uploadProgress)}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {details.comments.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={comment.user_profile?.avatar_url} />
                              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1 p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold">{comment.user_profile?.full_name}</span>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(comment.created_at), 'dd/MM/yy HH:mm')}</span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                              {comment.attachments && comment.attachments.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {comment.attachments.map((url, i) => {
                                    const isPdf = url.toLowerCase().endsWith('.pdf');
                                    return (
                                      <div key={i} className="group relative">
                                        <div 
                                          className="h-16 w-16 rounded border bg-card flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors"
                                          onClick={() => setPreviewFile({ url, type: isPdf ? 'application/pdf' : 'image' })}
                                        >
                                          {isPdf ? (
                                            <FileText className="h-6 w-6 text-muted-foreground" />
                                          ) : (
                                            <img src={url} alt="Attachment" className="h-full w-full object-cover" />
                                          )}
                                        </div>
                                        <a 
                                          href={url} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-dashed relative">
                        {isUploading && (
                          <Progress value={uploadProgress} className="absolute top-0 left-0 right-0 h-1 rounded-t-xl rounded-b-none" />
                        )}
                        
                        <Textarea 
                          placeholder="Adicionar nota técnica..." 
                          className="min-h-[80px] bg-background"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />
                        
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((url, i) => (
                              <div key={i} className="relative h-12 w-12 rounded border overflow-hidden">
                                {url.toLowerCase().endsWith('.pdf') ? (
                                  <div className="h-full w-full flex items-center justify-center bg-muted">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <img src={url} className="h-full w-full object-cover" />
                                )}
                                <button 
                                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                  className="absolute top-0 right-0 bg-destructive text-white p-0.5 hover:bg-destructive/90"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input 
                              type="file" 
                              className="hidden" 
                              ref={fileInputRef} 
                              onChange={handleFileUpload}
                              accept="image/*,application/pdf"
                              multiple
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              <Paperclip className="h-3 w-3 mr-2" />
                              Anexar
                            </Button>
                            {attachments.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {attachments.length} arquivo(s) prontos
                              </span>
                            )}
                          </div>
                          <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim() || addComment.isPending || isUploading}>
                            {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                            Comentar
                          </Button>
                        </div>
                      </div>
                    </section>

                  </div>

                  <div className="p-6 bg-muted/10 border-l space-y-6">
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-xs uppercase text-muted-foreground">Investigação</h4>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Causa Raiz</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.root_cause_notes || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, root_cause_notes: e.target.value }))}
                            className="text-xs min-h-[60px]"
                          />
                        ) : (
                          <p className="text-sm">{details.report.root_cause_notes || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Motivo do Bloqueio</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.blocker_reason || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, blocker_reason: e.target.value }))}
                            className="text-xs min-h-[60px]"
                            placeholder="Se estiver bloqueado, explique o porquê..."
                          />
                        ) : (
                          <p className="text-sm text-orange-600 font-medium">{details.report.blocker_reason || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Resumo da Resolução</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.resolution_summary || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, resolution_summary: e.target.value }))}
                            className="text-xs min-h-[60px]"
                            placeholder="Como foi resolvido?"
                          />
                        ) : (
                          <p className="text-sm text-green-600 font-medium">{details.report.resolution_summary || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Notas de Validação (QA)</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.validation_notes || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, validation_notes: e.target.value }))}
                            className="text-xs min-h-[60px]"
                            placeholder="Feedback do QA..."
                          />
                        ) : (
                          <p className="text-sm font-medium text-purple-600">{details.report.validation_notes || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Escopo da Correção</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.fix_scope || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, fix_scope: e.target.value }))}
                            className="text-xs min-h-[60px]"
                          />
                        ) : (
                          <p className="text-sm">{details.report.fix_scope || '—'}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Impacto Sistêmico</Label>
                        {isEditingTechnical ? (
                          <Textarea 
                            value={editForm.systemic_impact || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, systemic_impact: e.target.value }))}
                            className="text-xs min-h-[60px]"
                          />
                        ) : (
                          <p className="text-sm">{details.report.systemic_impact || '—'}</p>
                        )}
                      </div>
                    </section>


                    <section className="space-y-4 border-t pt-4">
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground flex items-center gap-2">
                        <History className="h-3 w-3" /> Histórico
                      </h4>
                      <div className="space-y-4">
                        {details.activities.slice(0, 5).map(log => (
                          <div key={log.id} className="text-xs border-l-2 border-primary/20 pl-3 py-1">
                            <p className="font-medium">Alterou <span className="text-primary">{log.field_name}</span></p>
                            <p className="text-muted-foreground italic">"{log.old_value || 'null'}" → "{log.new_value}"</p>
                            <p className="text-[10px] mt-1 opacity-60">{log.user_profile?.full_name} • {format(new Date(log.created_at), 'dd/MM HH:mm')}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Creation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Registrar Novo Erro de Teste</DialogTitle>
            <CardDescription>Preencha os detalhes técnicos para análise posterior</CardDescription>
          </DialogHeader>
          <ScrollArea className="pr-4">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label htmlFor="title">Título do Erro *</Label>
                  <Input 
                    id="title" 
                    placeholder="Ex: Crash no carregamento de notas XML" 
                    value={newReport.title}
                    onChange={(e) => setNewReport(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label htmlFor="module">Módulo / Área *</Label>
                  <Input 
                    id="module" 
                    placeholder="Ex: EntradaNota, PDV, Estoque" 
                    value={newReport.module}
                    onChange={(e) => setNewReport(prev => ({ ...prev, module: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição Detalhada *</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva o que aconteceu..." 
                  className="min-h-[100px]"
                  value={newReport.description}
                  onChange={(e) => setNewReport(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="severity">Severidade</Label>
                  <Select 
                    value={newReport.severity} 
                    onValueChange={(val) => setNewReport(prev => ({ ...prev, severity: val as any }))}
                  >
                    <SelectTrigger id="severity">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env">Ambiente</Label>
                  <Select 
                    value={newReport.environment} 
                    onValueChange={(val) => setNewReport(prev => ({ ...prev, environment: val as any }))}
                  >
                    <SelectTrigger id="env">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="route">Rota / URL</Label>
                  <Input 
                    id="route" 
                    placeholder="/entrada-nota" 
                    value={newReport.route}
                    onChange={(e) => setNewReport(prev => ({ ...prev, route: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steps">Passos para Reproduzir</Label>
                <Textarea 
                  id="steps" 
                  placeholder="1. Abrir página X...&#10;2. Clicar em Y..." 
                  value={newReport.reproduction_steps}
                  onChange={(e) => setNewReport(prev => ({ ...prev, reproduction_steps: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected">Comportamento Esperado</Label>
                  <Textarea 
                    id="expected" 
                    placeholder="O que deveria acontecer..." 
                    value={newReport.expected_behavior}
                    onChange={(e) => setNewReport(prev => ({ ...prev, expected_behavior: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observed">Comportamento Observado</Label>
                  <Textarea 
                    id="observed" 
                    placeholder="O que realmente aconteceu..." 
                    value={newReport.observed_behavior}
                    onChange={(e) => setNewReport(prev => ({ ...prev, observed_behavior: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateReport} disabled={createReport.isPending}>
              {createReport.isPending ? "Registrando..." : "Registrar Erro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium">Visualização de Anexo</DialogTitle>
            <div className="flex items-center gap-2 pr-8">
              <Button variant="outline" size="sm" asChild>
                <a href={previewFile?.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted/30 flex items-center justify-center p-4 overflow-hidden">
            {previewFile?.type === 'application/pdf' ? (
              <iframe 
                src={`${previewFile.url}#toolbar=0`} 
                className="w-full h-full border-0 rounded-lg shadow-lg bg-white"
                title="PDF Preview"
              />
            ) : (
              <img 
                src={previewFile?.url} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg" 
                alt="Preview" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


