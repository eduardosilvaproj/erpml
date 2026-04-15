import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * NF-e Consulta Edge Function
 * Validates the 44-digit access key from NF-e barcode,
 * extracts embedded metadata, and attempts to fetch full data.
 */

interface ChaveMetadata {
  uf: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tipoEmissao: string;
  codigoNumerico: string;
  digitoVerificador: string;
}

function parseChaveAcesso(chave: string): ChaveMetadata {
  const clean = chave.replace(/\s/g, "");
  if (!/^\d{44}$/.test(clean)) {
    throw new Error("Chave de acesso deve conter exatamente 44 dígitos numéricos.");
  }

  return {
    uf: clean.substring(0, 2),
    anoMes: clean.substring(2, 6),
    cnpjEmitente: clean.substring(6, 20),
    modelo: clean.substring(20, 22),
    serie: clean.substring(22, 25),
    numero: clean.substring(25, 34),
    tipoEmissao: clean.substring(34, 35),
    codigoNumerico: clean.substring(35, 43),
    digitoVerificador: clean.substring(43, 44),
  };
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function getUfName(code: string): string {
  const ufs: Record<string, string> = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
    "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
    "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
    "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
    "52": "GO", "53": "DF",
  };
  return ufs[code] || code;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Token não fornecido." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Usuário não autenticado." }, 401);
    }

    const body = await req.json().catch(() => null);
    const chave = body?.chave;

    if (!chave || typeof chave !== "string") {
      return jsonResponse({ error: "Campo 'chave' é obrigatório." }, 400);
    }

    const cleanChave = chave.replace(/\s/g, "");

    // Parse the access key to extract embedded metadata
    let metadata: ChaveMetadata;
    try {
      metadata = parseChaveAcesso(cleanChave);
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 400);
    }

    // Validate model (55 = NF-e, 65 = NFC-e)
    if (metadata.modelo !== "55" && metadata.modelo !== "65") {
      return jsonResponse({ error: "Código não corresponde a uma NF-e ou NFC-e válida." }, 400);
    }

    const ano = 2000 + parseInt(metadata.anoMes.substring(0, 2));
    const mes = parseInt(metadata.anoMes.substring(2, 4));
    const dataEmissao = `${ano}-${String(mes).padStart(2, "0")}-01`;

    const nfeNumber = metadata.numero.replace(/^0+/, "") || "0";

    // Build response with extracted metadata
    const result = {
      chave: cleanChave,
      numero: nfeNumber,
      serie: metadata.serie.replace(/^0+/, "") || "0",
      cnpjEmitente: metadata.cnpjEmitente,
      cnpjFormatado: formatCnpj(metadata.cnpjEmitente),
      uf: getUfName(metadata.uf),
      dataEmissao,
      modelo: metadata.modelo === "55" ? "NF-e" : "NFC-e",
      tipoEmissao: metadata.tipoEmissao,
      fonte: "chave_acesso",
      totalValue: 0,
      products: [],
      partialData: true,
      partialReason: "Consulta por chave retorna apenas os dados do cabeçalho. Para itens/produtos, importe o XML da nota.",
    };

    return jsonResponse(result);
  } catch (err) {
    console.error("Erro na consulta NF-e:", err);
    return jsonResponse({ error: "Erro interno ao processar a consulta." }, 500);
  }
});
