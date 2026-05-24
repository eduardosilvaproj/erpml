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
 * Formata um número para o padrão brasileiro com casas decimais configuráveis.
 * 
 * @param value - Valor numérico.
 * @param decimals - Número de casas decimais (padrão 0).
 * @returns {string} Número formatado.
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formata a diferença entre dois valores com sinal e casas decimais.
 * 
 * @param value - Valor da diferença.
 * @param decimals - Número de casas decimais.
 * @returns {string} String com sinal (Ex: +10 ou -5).
 */
export const formatDifference = (value: number, decimals: number = 0): string => {
  const formatted = formatNumber(Math.abs(value), decimals);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
};

/**
 * Formata um valor como porcentagem brasileira.
 * 
 * @param value - Valor (0.1 para 10%).
 * @param decimals - Casas decimais.
 * @returns {string} Valor formatado (Ex: "10,5%").
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};
