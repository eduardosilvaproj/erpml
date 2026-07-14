import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInHours } from "date-fns";


export interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

export interface TestErrorReport {
  id: string;
  title: string;
  description: string;
  module: string;
  route: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'triaged' | 'in_progress' | 'blocked' | 'ready_for_validation' | 'resolved' | 'closed' | 'wont_fix';
  environment: 'local' | 'staging' | 'production';
  reproduction_steps: string | null;
  expected_behavior: string | null;
  observed_behavior: string | null;
  root_cause_notes: string | null;
  fix_scope: string | null;
  systemic_impact: string | null;
  reported_by: string;
  assigned_to: string | null;
  validator_id: string | null;
  blocker_reason: string | null;
  resolution_summary: string | null;
  validation_notes: string | null;
  last_updated_by: string | null;
  created_at: string;
  updated_at: string;
  triaged_at: string | null;
  in_progress_at: string | null;
  ready_for_validation_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_status: 'normal' | 'warning' | 'overdue';
  // Joins
  assigned_to_profile?: any;
  validator_profile?: any;
  reported_by_profile?: any;
}

export const SLA_CONFIG = {
  critical: 4, // 4 hours
  high: 24,    // 24 hours
  medium: 72,  // 3 days
  low: 168     // 7 days
};

export function calculateSLA(report: TestErrorReport) {
  if (report.status === 'resolved') return { status: 'normal', remaining: 0 };
  
  const limit = SLA_CONFIG[report.severity];
  const elapsed = differenceInHours(new Date(), new Date(report.created_at));
  const remaining = limit - elapsed;

  let status: 'normal' | 'warning' | 'overdue' = 'normal';
  if (remaining <= 0) status = 'overdue';
  else if (remaining <= limit * 0.25) status = 'warning';

  return { status, remaining, elapsed, limit };
}

export interface ErrorReportsFilter {
  severity?: string;
  environment?: string;
  status?: string;
  assigned_to?: string;
  validator_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  sla_status?: string;
}

export interface TechnicalComment {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  attachments?: string[];
  created_at: string;
  user_profile?: any;
}

export interface ActivityLog {
  id: string;
  report_id: string;
  user_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_profile?: any;
}

export function useTestErrorReports(filters: ErrorReportsFilter = {}) {
  const {
    severity,
    environment,
    status,
    assigned_to,
    search,
    page = 1,
    pageSize = 10,
    orderBy = 'created_at',
    orderDirection = 'desc',
    sla_status
  } = filters;

  return useQuery({
    queryKey: ["test-error-reports", severity, environment, status, assigned_to, search, page, pageSize, orderBy, orderDirection, sla_status],
    queryFn: async () => {
      let query = supabase
        .from("test_error_reports")
        .select("*, profiles!test_error_reports_assigned_to_fkey(full_name, avatar_url), profiles!test_error_reports_validator_id_fkey(full_name, avatar_url), profiles!test_error_reports_reported_by_fkey(full_name, avatar_url)", { count: 'exact' });



      if (severity && severity !== 'all') query = query.eq('severity', severity);
      if (environment && environment !== 'all') query = query.eq('environment', environment);
      if (status && status !== 'all') query = query.eq('status', status);
      if (sla_status && sla_status !== 'all') query = query.eq('sla_status', sla_status);
      
      if (assigned_to && assigned_to !== 'all') {
        if (assigned_to === 'unassigned') query = query.is('assigned_to', null);
        else query = query.eq('assigned_to', assigned_to);
      }
      
      if (filters.validator_id && filters.validator_id !== 'all') {
        if (filters.validator_id === 'unassigned') query = query.is('validator_id', null);
        else query = query.eq('validator_id', filters.validator_id);
      }
      
      if (search) {
        query = query.or(`title.ilike.%${search}%,module.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      const { data, error, count } = await query;
      if (error) throw error;
      
      return {
        data: (data || []).map((r: any) => ({
          ...r,
          assigned_to_profile: r.profiles?.[0] || r.profiles,
          validator_profile: r.profiles_validator_id?.[0] || r.profiles_validator_id,
          reported_by_profile: r.profiles_reported_by?.[0] || r.profiles_reported_by
        })) as TestErrorReport[],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });
}

export function useErrorReportsMetrics() {
  return useQuery({
    queryKey: ["test-error-reports-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_error_reports")
        .select("id, title, status, severity, sla_status, created_at, updated_at, resolved_at, module, environment, assigned_to, validator_id, triaged_at, in_progress_at, ready_for_validation_at, closed_at");



      
      if (error) throw error;

      const metrics = {
        total: data.length,
        open: data.filter(r => r.status === 'open').length,
        critical: data.filter(r => r.severity === 'critical' && r.status !== 'resolved').length,
        inProgress: data.filter(r => r.status === 'in_progress').length,
        resolved: data.filter(r => r.status === 'resolved').length,
        overdue: data.filter(r => r.sla_status === 'overdue' && r.status !== 'resolved' && r.status !== 'closed').length,
        unassigned: data.filter(r => !r.assigned_to).length,
        unvalidated: data.filter(r => !r.validator_id).length,
        blocked: data.filter(r => r.status === 'blocked').length,
        readyForValidation: data.filter(r => r.status === 'ready_for_validation').length,
        stale: data.filter(r => {
          if (r.status === 'resolved') return false;
          const lastUpdate = new Date(r.updated_at || r.created_at);
          return differenceInHours(new Date(), lastUpdate) > 48;
        }).length,
        severityDistribution: {
          low: data.filter(r => r.severity === 'low').length,
          medium: data.filter(r => r.severity === 'medium').length,
          high: data.filter(r => r.severity === 'high').length,

          critical: data.filter(r => r.severity === 'critical').length,
        },
        statusDistribution: {
          open: data.filter(r => r.status === 'open').length,
          triaged: data.filter(r => r.status === 'triaged').length,
          inProgress: data.filter(r => r.status === 'in_progress').length,
          resolved: data.filter(r => r.status === 'resolved').length,
          closed: data.filter(r => r.status === 'closed').length,
          blocked: data.filter(r => r.status === 'blocked').length,
          ready_for_validation: data.filter(r => r.status === 'ready_for_validation').length,
        },
        avgTimeByStage: {
          triaging: data.filter(r => r.triaged_at && r.created_at).reduce((acc, r, _, arr) => acc + (differenceInHours(new Date(r.triaged_at!), new Date(r.created_at)) / arr.length), 0),
          execution: data.filter(r => r.resolved_at && r.in_progress_at).reduce((acc, r, _, arr) => acc + (differenceInHours(new Date(r.resolved_at!), new Date(r.in_progress_at!)) / arr.length), 0),
          validation: data.filter(r => r.closed_at && r.ready_for_validation_at).reduce((acc, r, _, arr) => acc + (differenceInHours(new Date(r.closed_at!), new Date(r.ready_for_validation_at!)) / arr.length), 0),
        },
        moduleDistribution: data.reduce((acc: any, r) => {
          acc[r.module] = (acc[r.module] || 0) + 1;
          return acc;
        }, {}),
        avgResolutionTime: data
          .filter(r => r.resolved_at && r.created_at)
          .reduce((acc, r, _, arr) => acc + (differenceInHours(new Date(r.resolved_at!), new Date(r.created_at)) / arr.length), 0),
        rawData: data
      };


      return metrics;
    },
  });
}

export function useCreateTestErrorReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (report: Omit<TestErrorReport, 'id' | 'created_at' | 'updated_at' | 'sla_status' | 'triaged_at' | 'in_progress_at' | 'ready_for_validation_at' | 'resolved_at' | 'closed_at'>) => {
      const { data, error } = await supabase
        .from("test_error_reports")
        .insert(report as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-error-reports"] });
      queryClient.invalidateQueries({ queryKey: ["test-error-reports-metrics"] });
    },
  });
}

export function useUpdateTestErrorReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, audit, userId }: { id: string, updates: Partial<TestErrorReport>, audit?: { field: string, old: string | null, new: string | null }[], userId: string }) => {
      const { error: updateError } = await supabase
        .from("test_error_reports")
        .update({ ...updates, updated_at: new Date().toISOString(), last_updated_by: userId } as any)
        .eq("id", id);
      
      if (updateError) throw updateError;

      if (audit && audit.length > 0) {
        const logs = audit.map(a => ({
          report_id: id,
          user_id: userId,
          field_name: a.field,
          old_value: String(a.old || ""),
          new_value: String(a.new || "")
        }));
        
        await supabase.from("test_error_activity_log").insert(logs as any);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["test-error-reports"] });
      queryClient.invalidateQueries({ queryKey: ["test-error-reports-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["test-error-report", variables.id] });
    },
  });
}

export function useErrorReportDetails(id: string) {
  return useQuery({
    queryKey: ["test-error-report", id],
    enabled: !!id,
    queryFn: async () => {
      const [reportRes, commentsRes, logsRes] = await Promise.all([
        supabase.from("test_error_reports").select("*, profiles!test_error_reports_assigned_to_fkey(full_name, avatar_url), profiles!test_error_reports_validator_id_fkey(full_name, avatar_url)").eq("id", id).single(),


        supabase.from("test_error_comments").select("*, profiles(full_name, avatar_url)").eq("report_id", id).order("created_at", { ascending: true }),
        supabase.from("test_error_activity_log").select("*, profiles(full_name, avatar_url)").eq("report_id", id).order("created_at", { ascending: false })
      ]);

      if (reportRes.error) throw reportRes.error;

      return {
        report: reportRes.data as TestErrorReport,
        comments: (commentsRes.data || []).map((c: any) => ({ 
          ...c, 
          user_profile: c.profiles?.[0] || c.profiles,
          attachments: Array.isArray(c.attachments) ? c.attachments : []
        })) as TechnicalComment[],
        activities: (logsRes.data || []).map((l: any) => ({ ...l, user_profile: l.profiles?.[0] || l.profiles })) as ActivityLog[]
      };
    }
  });
}

export function useAddErrorComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, userId, content, attachments }: { reportId: string, userId: string, content: string, attachments?: string[] }) => {
      const { data, error } = await supabase
        .from("test_error_comments")
        .insert({ 
          report_id: reportId, 
          user_id: userId, 
          content,
          attachments: attachments || []
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["test-error-report", variables.reportId] });
    }
  });
}

export function useAdminNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_internal_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_internal_notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    }
  });
}

export function useAdminTeam() {
  return useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .limit(100);
      if (error) throw error;
      return data;
    }
  });
}



