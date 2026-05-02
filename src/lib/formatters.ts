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

/**
 * Formata um número para o padrão brasileiro (pontos para milhar).
 * 
 * @param value - Valor numérico.
 * @returns {string} Número formatado.
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

/**
 * Formata a diferença entre dois valores (Ex: +10 ou -5).
 * 
 * @param value - Valor da diferença.
 * @returns {string} String com sinal.
 */
export const formatDifference = (value: number): string => {
  return value > 0 ? `+${value}` : `${value}`;
};

/**
 * Formata um valor como porcentagem brasileira.
 * 
 * @param value - Valor (0.1 para 10%).
 * @returns {string} Valor formatado (Ex: "10%").
 */
export const formatPercent = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};
