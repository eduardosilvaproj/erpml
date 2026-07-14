import { ConferenceRow, ConferenceTipo } from "@/hooks/useConferenceHistory";

/**
 * Normaliza uma conferência garantindo que campos opcionais ou legados tenham valores padrão consistentes.
 */
export function normalizeConference(conf: any): ConferenceRow {
  const tipo = conf.tipo || "nota_fiscal";
  const type = conf.type || "full";
  
  // Se for inventário, o nome padrão é diferente
  const defaultPrefix = tipo === "inventario" ? "Inventário" : "Conferência";
  const formattedDate = new Date(conf.created_at || new Date()).toLocaleString("pt-BR");
  
  return {
    ...conf,
    tipo: tipo as ConferenceTipo,
    type: type,
    nome: conf.nome || `${defaultPrefix} ${formattedDate}`,
    status: conf.status || "em_andamento",
    section_name: conf.section_name || null,
    invoice_id: conf.invoice_id || null,
    started_at: conf.started_at || conf.created_at || new Date().toISOString(),
    updated_at: conf.updated_at || conf.created_at || new Date().toISOString(),
  };
}

/**
 * Normaliza uma lista de conferências.
 */
export function normalizeConferences(conferences: any[]): ConferenceRow[] {
  return (conferences || []).map(normalizeConference);
}
