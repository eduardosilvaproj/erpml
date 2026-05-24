export const normalizeHeader = (header: string): string => {
  if (!header) return '';
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_');
};

export const normalizeNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  
  // Se já for número, retorna direto
  if (typeof value === 'number') return isFinite(value) ? value : null;
  
  const str = String(value).trim();
  if (!str) return null;

  // Remove símbolos monetários comuns e espaços
  const cleanStr = str.replace(/[R$\s]/g, '');
  
  // Lógica para detectar o formato (BR vs US)
  // Se houver vírgula E ponto: 
  //   1.234,56 -> BR
  //   1,234.56 -> US
  // Se houver apenas vírgula:
  //   1234,56 -> BR
  // Se houver apenas ponto:
  //   1234.56 -> US
  
  let normalized = cleanStr;
  const hasComma = cleanStr.includes(',');
  const hasDot = cleanStr.includes('.');

  if (hasComma && hasDot) {
    if (cleanStr.indexOf(',') > cleanStr.indexOf('.')) {
      // 1.234,56 (BR)
      normalized = cleanStr.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 (US)
      normalized = cleanStr.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 1234,56 (BR)
    normalized = cleanStr.replace(',', '.');
  }
  
  const num = parseFloat(normalized);
  return isFinite(num) ? num : null;
};

export const normalizeString = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const normalizeBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return ['sim', 'ativo', 'true', '1', 'yes', 'on'].includes(str);
};
