// NF-e XML Parser - Extracts product data from Brazilian electronic invoice XML

export interface NFeProduct {
  code: string;        // cProd
  ean: string;         // cEAN (barcode)
  description: string; // xProd
  ncm: string;         // NCM
  cfop: string;        // CFOP
  unit: string;        // uCom
  quantity: number;     // qCom
  unitValue: number;    // vUnCom
  totalValue: number;   // vProd
}

export interface NFeData {
  number: string;       // nNF
  series: string;       // serie
  issuerName: string;   // xNome (emit)
  issuerCnpj: string;   // CNPJ (emit)
  totalValue: number;   // vNF
  issueDate: string;    // dhEmi
  products: NFeProduct[];
}

function getTagValue(element: Element, tagName: string): string {
  // Search with and without namespace
  const el = element.getElementsByTagName(tagName)[0]
    || element.getElementsByTagName(`ns:${tagName}`)[0];
  return el?.textContent?.trim() || "";
}

export function parseNFeXml(xmlString: string): NFeData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Arquivo XML inválido. Verifique se é um XML de NF-e válido.");
  }

  // Try to find NFe or nfeProc root
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) {
    throw new Error("XML não contém dados de NF-e (infNFe não encontrado).");
  }

  // Header - ide
  const ide = infNFe.getElementsByTagName("ide")[0];
  const number = ide ? getTagValue(ide, "nNF") : "";
  const series = ide ? getTagValue(ide, "serie") : "";
  const issueDate = ide ? getTagValue(ide, "dhEmi") : "";

  // Issuer - emit
  const emit = infNFe.getElementsByTagName("emit")[0];
  const issuerName = emit ? getTagValue(emit, "xNome") : "";
  const issuerCnpj = emit ? getTagValue(emit, "CNPJ") : "";

  // Total
  const total = infNFe.getElementsByTagName("ICMSTot")[0];
  const totalValue = total ? parseFloat(getTagValue(total, "vNF")) || 0 : 0;

  // Products - det
  const detElements = infNFe.getElementsByTagName("det");
  const products: NFeProduct[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;

    const code = getTagValue(prod, "cProd");
    let ean = getTagValue(prod, "cEAN");
    if (ean === "SEM GTIN" || ean === "") ean = "";

    products.push({
      code,
      ean,
      description: getTagValue(prod, "xProd"),
      ncm: getTagValue(prod, "NCM"),
      cfop: getTagValue(prod, "CFOP"),
      unit: getTagValue(prod, "uCom"),
      quantity: parseFloat(getTagValue(prod, "qCom")) || 0,
      unitValue: parseFloat(getTagValue(prod, "vUnCom")) || 0,
      totalValue: parseFloat(getTagValue(prod, "vProd")) || 0,
    });
  }

  if (products.length === 0) {
    throw new Error("Nenhum produto encontrado no XML.");
  }

  return { number, series, issuerName, issuerCnpj, totalValue, issueDate, products };
}

// Fuzzy string similarity (Levenshtein-based)
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

export function stringSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(la, lb) / maxLen;
}

export interface MatchResult {
  xmlProduct: NFeProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchType: "exact" | "fuzzy" | "new" | "none";
  confidence: number;
}

export function matchProducts(
  xmlProducts: NFeProduct[],
  dbProducts: { id: string; name: string; barcode: string | null; sku: string }[]
): MatchResult[] {
  return xmlProducts.map((xp) => {
    // 1. Exact match by barcode/EAN
    if (xp.ean) {
      const exactMatch = dbProducts.find((dp) => dp.barcode === xp.ean);
      if (exactMatch) {
        return {
          xmlProduct: xp,
          matchedProductId: exactMatch.id,
          matchedProductName: exactMatch.name,
          matchType: "exact" as const,
          confidence: 100,
        };
      }
    }

    // 2. Exact match by code = SKU
    const skuMatch = dbProducts.find(
      (dp) => dp.sku.toLowerCase() === xp.code.toLowerCase()
    );
    if (skuMatch) {
      return {
        xmlProduct: xp,
        matchedProductId: skuMatch.id,
        matchedProductName: skuMatch.name,
        matchType: "exact" as const,
        confidence: 100,
      };
    }

    // 3. Fuzzy match by description/name
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;
    for (const dp of dbProducts) {
      const score = stringSimilarity(xp.description, dp.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = dp;
      }
    }

    if (bestMatch && bestScore >= 0.6) {
      return {
        xmlProduct: xp,
        matchedProductId: bestMatch.id,
        matchedProductName: bestMatch.name,
        matchType: "fuzzy" as const,
        confidence: Math.round(bestScore * 100),
      };
    }

    // 4. No match - new product
    return {
      xmlProduct: xp,
      matchedProductId: null,
      matchedProductName: null,
      matchType: "none" as const,
      confidence: 0,
    };
  });
}
