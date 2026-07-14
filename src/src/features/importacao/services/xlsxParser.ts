import * as XLSX from 'xlsx';

export const parseXLSX = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          throw new Error("Não foi possível ler o conteúdo do arquivo.");
        }

        const data = new Uint8Array(buffer as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: true
        });

        if (!workbook.SheetNames.length) {
          throw new Error("O arquivo Excel está vazio ou não possui planilhas.");
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte para JSON com valores padronizados
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: "", // Valor padrão para células vazias
          raw: false,  // Transforma tudo em string formatada (evita problemas com números/datas)
          blankrows: false // Pula linhas em branco
        });

        if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error("Nenhum dado encontrado na planilha. Verifique se o arquivo segue o modelo.");
        }

        // Remove linhas que são objetos vazios ou só tem strings vazias
        const cleanedData = jsonData.filter(row => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== "");
        });

        if (cleanedData.length === 0) {
          throw new Error("A planilha parece conter apenas linhas vazias.");
        }

        resolve(cleanedData);
      } catch (error: any) {
        console.error("Erro no parser XLSX:", error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(new Error("Erro ao carregar o arquivo Excel."));
    reader.readAsArrayBuffer(file);
  });
};
