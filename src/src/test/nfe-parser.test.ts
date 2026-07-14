import { describe, it, expect } from "vitest";
import { parseNFeXml, matchProducts, stringSimilarity } from "@/lib/nfe-parser";

const SAMPLE_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <ide>
        <nNF>12345</nNF>
        <serie>1</serie>
        <dhEmi>2026-03-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Fornecedor Teste LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>PROD001</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Camiseta Algodão Branca M</xProd>
          <NCM>61091000</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>25.5000</vUnCom>
          <vProd>255.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD002</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Calça Jeans Azul 42</xProd>
          <NCM>62034200</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>89.9000</vUnCom>
          <vProd>449.50</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>704.50</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const SAMPLE_NFE_XML_WITH_PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<ns0:nfeProc xmlns:ns0="http://www.portalfiscal.inf.br/nfe">
  <ns0:NFe>
    <ns0:infNFe>
      <ns0:ide>
        <ns0:nNF>54321</ns0:nNF>
        <ns0:serie>2</ns0:serie>
        <ns0:dhEmi>2026-04-10T08:00:00-03:00</ns0:dhEmi>
      </ns0:ide>
      <ns0:emit>
        <ns0:CNPJ>99887766000155</ns0:CNPJ>
        <ns0:xNome>Fornecedor Prefixado SA</ns0:xNome>
      </ns0:emit>
      <ns0:det nItem="1">
        <ns0:prod>
          <ns0:cProd>SKU-01</ns0:cProd>
          <ns0:cEAN>789.123.456.789-0</ns0:cEAN>
          <ns0:xProd>Kit Caneca</ns0:xProd>
          <ns0:NCM>12345678</ns0:NCM>
          <ns0:CFOP>5102</ns0:CFOP>
          <ns0:uCom>UN</ns0:uCom>
          <ns0:qCom>2.0000</ns0:qCom>
          <ns0:vUnCom>12.5000</ns0:vUnCom>
          <ns0:vProd>25.00</ns0:vProd>
        </ns0:prod>
        <ns0:infAdProd>Cor branca - embalagem premium</ns0:infAdProd>
      </ns0:det>
      <ns0:total>
        <ns0:ICMSTot>
          <ns0:vNF>25.00</ns0:vNF>
        </ns0:ICMSTot>
      </ns0:total>
    </ns0:infNFe>
  </ns0:NFe>
</ns0:nfeProc>`;

describe("NF-e XML Parser", () => {
  it("parses valid NF-e XML correctly", () => {
    const result = parseNFeXml(SAMPLE_NFE_XML);
    expect(result.number).toBe("12345");
    expect(result.series).toBe("1");
    expect(result.issuerName).toBe("Fornecedor Teste LTDA");
    expect(result.issuerCnpj).toBe("12345678000190");
    expect(result.totalValue).toBe(704.5);
    expect(result.products).toHaveLength(2);
  });

  it("extracts product data correctly", () => {
    const result = parseNFeXml(SAMPLE_NFE_XML);
    const p1 = result.products[0];
    expect(p1.code).toBe("PROD001");
    expect(p1.ean).toBe("7891234567890");
    expect(p1.description).toBe("Camiseta Algodão Branca M");
    expect(p1.quantity).toBe(10);
    expect(p1.unitValue).toBe(25.5);
    expect(p1.totalValue).toBe(255);
  });

  it("handles SEM GTIN barcode", () => {
    const result = parseNFeXml(SAMPLE_NFE_XML);
    expect(result.products[1].ean).toBe("");
  });

  it("parses prefixed XML namespaces and infAdProd", () => {
    const result = parseNFeXml(SAMPLE_NFE_XML_WITH_PREFIX);
    expect(result.number).toBe("54321");
    expect(result.issuerName).toBe("Fornecedor Prefixado SA");
    expect(result.products[0].additionalInfo).toBe("Cor branca - embalagem premium");
  });

  it("throws on invalid XML", () => {
    expect(() => parseNFeXml("<invalid>")).toThrow();
  });

  it("throws on XML without NF-e data", () => {
    expect(() => parseNFeXml('<?xml version="1.0"?><root><data>test</data></root>')).toThrow("infNFe");
  });
});

describe("Product Matching", () => {
  const dbProducts = [
    { id: "1", name: "Camiseta Algodão Branca M", barcode: "7891234567890", sku: "SKU-001" },
    { id: "2", name: "Calça Jeans Azul", barcode: "7891234567891", sku: "PROD002", gtin_cx: "7891234567000" },
    {
      id: "3",
      name: "Tênis Esportivo",
      barcode: "7891234567892",
      sku: "SKU-003",
      product_gtins: [{ gtin: "7891234567555", tipo: "pacote", box_quantity: 6 }],
    },
  ];

  it("matches by barcode (exact)", () => {
    const xmlProducts = [{ code: "X", ean: "7891234567890", description: "Algo", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("exact");
    expect(results[0].matchedProductId).toBe("1");
    expect(results[0].confidence).toBe(100);
  });

  it("matches by gtin_cx when the unit barcode is different", () => {
    const xmlProducts = [{ code: "PROD002", ean: "7891234567000", description: "Qualquer", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("exact");
    expect(results[0].matchedProductId).toBe("2");
  });

  it("matches by alternate GTIN from product_gtins", () => {
    const xmlProducts = [{ code: "X", ean: "7891234567555", description: "Tênis pacote", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("exact");
    expect(results[0].matchedProductId).toBe("3");
  });

  it("returns none when only SKU matches but there is no EAN/GTIN match", () => {
    const xmlProducts = [{ code: "PROD002", ean: "", description: "Qualquer", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("none");
    expect(results[0].matchedProductId).toBeNull();
  });

  it("returns none when only description is similar", () => {
    const xmlProducts = [{ code: "X", ean: "", description: "Calça Jeans Azul 42", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("none");
    expect(results[0].matchedProductId).toBeNull();
  });

  it("returns none for unmatched products", () => {
    const xmlProducts = [{ code: "X", ean: "", description: "Produto Completamente Diferente XYZ", ncm: "", cfop: "", unit: "UN", quantity: 1, unitValue: 10, totalValue: 10 }];
    const results = matchProducts(xmlProducts, dbProducts);
    expect(results[0].matchType).toBe("none");
    expect(results[0].matchedProductId).toBeNull();
  });

  it("matches barcodes even with formatting differences", () => {
    const formattedDbProducts = [
      { id: "10", name: "Kit Caneca", barcode: "7891234567890", sku: "SKU01" },
    ];

    const results = matchProducts([
      {
        code: "SKU-01",
        ean: "789.123.456.789-0",
        description: "Kit Caneca",
        ncm: "",
        cfop: "",
        unit: "UN",
        quantity: 1,
        unitValue: 10,
        totalValue: 10,
        additionalInfo: "Cor branca",
      },
    ], formattedDbProducts);

    expect(results[0].matchType).toBe("exact");
    expect(results[0].matchedProductId).toBe("10");
  });
});

describe("String Similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(stringSimilarity("hello", "hello")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(stringSimilarity("Hello", "hello")).toBe(1);
  });

  it("returns high score for similar strings", () => {
    expect(stringSimilarity("Camiseta Branca", "Camiseta Branca M")).toBeGreaterThan(0.8);
  });

  it("returns low score for different strings", () => {
    expect(stringSimilarity("ABC", "XYZ")).toBeLessThan(0.5);
  });
});
