import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker properly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const parsePDF = async (file: File): Promise<any[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textRows: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];
    
    // Group items by their vertical position (y coordinate)
    const lines: { [key: number]: any[] } = {};
    items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // Sort y coordinates descending
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    sortedY.forEach(y => {
      const row = lines[y]
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(item => item.str)
        .join(' ');
      if (row.trim()) textRows.push(row);
    });
  }

  // Very basic heuristic to convert rows to objects (will need manual mapping)
  return textRows.map((row, index) => ({
    raw_text: row,
    _index: index
  }));
};
