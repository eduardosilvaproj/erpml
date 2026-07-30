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
  additionalInfo?: string; // infAdProd
}

export interface NFeSupplier {
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

export interface NFeData {
  number: string;       // nNF
  series: string;       // serie
  issuerName: string;   // xNome (emit)
  issuerCnpj: string;   // CNPJ (emit)
  totalValue: number;   // vNF
  issueDate: string;    // dhEmi
  products: NFeProduct[];
  supplier?: NFeSupplier;
}

function getFirstElementByTagName(element: Element | Document, tagName: string): Element | null {
  const directMatch = element.getElementsByTagName(tagName)[0]
    || element.getElementsByTagName(`ns:${tagName}`)[0];

  if (directMatch) return directMatch;

  const allElements = element.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const current = allElements[i];
    if (current.localName === tagName) {
      return current;
    }
  }

  return null;
}

function getTagValue(element: Element, tagName: string): string {
  const el = getFirstElementByTagName(element, tagName);
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
  const infNFe = getFirstElementByTagName(doc, "infNFe");
  if (!infNFe) {
    throw new Error("XML não contém dados de NF-e (infNFe não encontrado).");
  }

  // Header - ide
  const ide = getFirstElementByTagName(infNFe, "ide");
  const number = ide ? getTagValue(ide, "nNF").trim().replace(/^0+/, "") : "";
  const series = ide ? getTagValue(ide, "serie") : "";
  const issueDate = ide ? getTagValue(ide, "dhEmi") : "";

  // Issuer - emit
  const emit = getFirstElementByTagName(infNFe, "emit");
  const issuerName = emit ? getTagValue(emit, "xNome") : "";
  const issuerCnpj = emit ? getTagValue(emit, "CNPJ") : "";
  
  let supplier: NFeSupplier | undefined;
  if (emit) {
    const enderEmit = getFirstElementByTagName(emit, "enderEmit");
    const emailEl = getFirstElementByTagName(doc.documentElement, "email");
    
    supplier = {
      razao_social: issuerName,
      nome_fantasia: getTagValue(emit, "xFant"),
      cnpj: issuerCnpj,
      ie: getTagValue(emit, "IE"),
      telefone: enderEmit ? getTagValue(enderEmit, "fone") : undefined,
      email: emailEl?.textContent?.trim(),
      cep: enderEmit ? getTagValue(enderEmit, "CEP") : undefined,
      logradouro: enderEmit ? getTagValue(enderEmit, "xLgr") : undefined,
      numero: enderEmit ? getTagValue(enderEmit, "nro") : undefined,
      bairro: enderEmit ? getTagValue(enderEmit, "xBairro") : undefined,
      municipio: enderEmit ? getTagValue(enderEmit, "xMun") : undefined,
      uf: enderEmit ? getTagValue(enderEmit, "UF") : undefined,
    };
  }

  // Total
  const total = getFirstElementByTagName(infNFe, "ICMSTot");
  const totalValue = total ? parseFloat(getTagValue(total, "vNF")) || 0 : 0;

  // Products - det
  const detElements = Array.from(infNFe.getElementsByTagName("*")).filter((el) => el.localName === "det");
  const products: NFeProduct[] = [];

  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    const prod = getFirstElementByTagName(det, "prod");
    if (!prod) continue;

    const code = getTagValue(prod, "cProd");
    let ean = getTagValue(prod, "cEAN");
    if (ean === "SEM GTIN" || ean === "") ean = "";
    const additionalInfo = getTagValue(det, "infAdProd");
    const description = getTagValue(prod, "xProd") || additionalInfo || code || "Produto sem descrição";

    products.push({
      code,
      ean,
      description,
      ncm: getTagValue(prod, "NCM"),
      cfop: getTagValue(prod, "CFOP"),
      unit: getTagValue(prod, "uCom"),
      quantity: parseFloat(getTagValue(prod, "qCom")) || 0,
      unitValue: parseFloat(getTagValue(prod, "vUnCom")) || 0,
      totalValue: parseFloat(getTagValue(prod, "vProd")) || 0,
      additionalInfo: additionalInfo || undefined,
    });
  }

  if (products.length === 0) {
    throw new Error("Nenhum produto encontrado no XML.");
  }

  return { number, series, issuerName, issuerCnpj, totalValue, issueDate, products, supplier };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdentifier(value: string | null | undefined): string {
  return normalizeText(value || "").replace(/[^a-z0-9]/g, "");
}

function normalizeBarcode(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function getProductSearchText(product: NFeProduct): string {
  return [product.description, product.additionalInfo].filter(Boolean).join(" ").trim();
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
  const la = normalizeText(a);
  const lb = normalizeText(b);
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(la, lb) / maxLen;
}

export interface MatchResult {
  xmlProduct: NFeProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedProductBarcode: string | null;
  matchedProductEan: string | null;
  matchedProductSku: string | null;
  matchedProductGtinCx: string | null;
  matchedProductBoxQty: number | null;
  matchType: "exact" | "fuzzy" | "new" | "none";
  confidence: number;
  newEan?: string;
  eanPending?: boolean;
  adjusted?: boolean;
}

export function matchProducts(
  xmlProducts: NFeProduct[],
  dbProducts: {
    id: string; name: string; barcode: string | null; ean?: string | null; sku: string;
    gtin_cx?: string | null; box_quantity?: number | null;
    product_gtins?: { gtin: string; tipo?: string; box_quantity?: number }[];
    product_supplier_skus?: { supplier_sku: string }[];
  }[]
): MatchResult[] {
  return xmlProducts.map((xp) => {
    const normalizedXmlBarcode = normalizeBarcode(xp.ean);

    // Regra Fundamental: Match PRIORITARIAMENTE por EAN
    if (normalizedXmlBarcode) {
      // 1. Match exato por EAN ou Barcode
      let match = dbProducts.find((dp) =>
        normalizeBarcode(dp.ean) === normalizedXmlBarcode ||
        normalizeBarcode(dp.barcode) === normalizedXmlBarcode
      );

      // 2. Fallback 1: Match por GTIN de Caixa (gtin_cx)
      if (!match) {
        match = dbProducts.find((dp) => normalizeBarcode(dp.gtin_cx) === normalizedXmlBarcode);
      }

      // 3. Fallback 2: Match por GTINs alternativos (product_gtins)
      if (!match) {
        match = dbProducts.find((dp) =>
          dp.product_gtins?.some(pg => normalizeBarcode(pg.gtin) === normalizedXmlBarcode)
        );
      }

      if (match) {
        return {
          xmlProduct: xp,
          matchedProductId: match.id,
          matchedProductName: match.name,
          matchedProductBarcode: match.barcode,
          matchedProductEan: match.ean ?? null,
          matchedProductSku: match.sku,
          matchedProductGtinCx: match.gtin_cx ?? null,
          matchedProductBoxQty: match.box_quantity ?? null,
          matchType: "exact" as const,
          confidence: 100,
        };
      }
    }

    // Fallback: Match por SKU do fornecedor quando EAN nao estiver disponivel
    if (!normalizedXmlBarcode) {
      const normalizedXmlCode = normalizeIdentifier(xp.code);

      if (normalizedXmlCode) {
        // 1. Match por SKU do produto
        let match = dbProducts.find((dp) =>
          normalizeIdentifier(dp.sku) === normalizedXmlCode
        );

        // 2. Match por supplier_sku em product_supplier_skus (SKUs de fornecedores anteriores)
        if (!match) {
          match = dbProducts.find((dp) =>
            dp.product_supplier_skus?.some(ps => normalizeIdentifier(ps.supplier_sku) === normalizedXmlCode)
          );
        }

        if (match) {
          return {
            xmlProduct: xp,
            matchedProductId: match.id,
            matchedProductName: match.name,
            matchedProductBarcode: match.barcode,
            matchedProductEan: match.ean ?? null,
            matchedProductSku: match.sku,
            matchedProductGtinCx: match.gtin_cx ?? null,
            matchedProductBoxQty: match.box_quantity ?? null,
            matchType: "exact" as const,
            confidence: 100,
          };
        }
      }
    }

    // NUNCA usar nome ou descricao como match automatico
    // Se nao encontrou por EAN/GTIN/SKU, trata como novo produto para evitar erros de estoque
    return {
      xmlProduct: xp,
      matchedProductId: null,
      matchedProductName: null,
      matchedProductBarcode: null,
      matchedProductEan: null,
      matchedProductSku: null,
      matchedProductGtinCx: null,
      matchedProductBoxQty: null,
      matchType: "none" as const,
      confidence: 0,
    };
  });
}
