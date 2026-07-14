import Papa from 'papaparse';

export const parseCSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy', // Pula linhas vazias e linhas com apenas espaços
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          console.error("Erros PapaParse:", results.errors);
          reject(new Error("Erro ao processar arquivo CSV. Verifique o formato."));
          return;
        }

        if (!results.data || results.data.length === 0) {
          reject(new Error("O arquivo CSV está vazio."));
          return;
        }

        // Filtra linhas vazias residuais
        const cleanedData = results.data.filter((row: any) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== "");
        });

        if (cleanedData.length === 0) {
          reject(new Error("Nenhum dado válido encontrado no CSV."));
          return;
        }

        resolve(cleanedData);
      },
      error: (error) => {
        console.error("Erro PapaParse:", error);
        reject(new Error("Erro de leitura do arquivo CSV."));
      }
    });
  });
};
