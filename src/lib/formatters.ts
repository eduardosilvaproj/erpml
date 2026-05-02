/**
 * Utilitário para formatar valores monetários em Real Brasileiro (BRL).
 * 
 * @param value - Valor numérico a ser formatado.
 * @returns {string} Valor formatado (Ex: "R$ 1.250,00").
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formata uma data para o padrão brasileiro (DD/MM/AAAA).
 * 
 * @param date - Objeto Date ou string de data.
 * @returns {string} Data formatada.
 */
export const formatDate = (date: Date | string): string => {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
};
