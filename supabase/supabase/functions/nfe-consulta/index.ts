import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

/**
 * NF-e Consulta Edge Function
 * Supports both 44-digit access key and NFe number search.
 * When a number is provided, it searches the local 'invoices' table.
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
  if (!cnpj) return "";
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

Deno.serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req);
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const jsonResponse = (payload: unknown, status = 200) => {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Token não fornecido ou inválido." }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Erro de autenticação:", authError);
      return jsonResponse({ error: "Usuário não autenticado." }, 401);
    }

    // Get company_id for the user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      console.error("Erro ao buscar perfil:", profileError);
      return jsonResponse({ error: "Empresa não vinculada ao usuário." }, 403);
    }

    const companyId = profile.company_id;

    const body = await req.json().catch(() => null);
    const chave = body?.chave;
    const number = body?.number;
    const series = body?.series;

    if (!chave && !number) {
      return jsonResponse({ error: "Informe a chave de acesso ou o número da nota." }, 400);
    }

    // CASE 1: SEARCH BY NUMBER (IN DATABASE)
    if (number && (!chave || chave.length < 44)) {
      console.log(`Buscando nota por número: ${number}, série: ${series}, empresa: ${companyId}`);
      
      const query = supabase
        .from("invoices")
        .select("*")
        .eq("company_id", companyId)
        .or(`number.eq.${number},number.eq.${number.padStart(9, '0')}`);

      if (series) {
        query.eq("series", series);
      }

      const { data: invoices, error: dbError } = await query.order('created_at', { ascending: false });

      if (dbError) {
        console.error("Erro no banco de dados:", dbError);
        return jsonResponse({ error: "Erro ao consultar banco de dados de notas." }, 500);
      }

      if (!invoices || invoices.length === 0) {
        return jsonResponse({ 
          error: `Nota fiscal nº ${number} não encontrada para sua empresa. Certifique-se de que o XML já foi importado anteriormente.` 
        }, 404);
      }

      const inv = invoices[0];
      
      // Fetch items for this invoice
      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", inv.id);

      if (itemsError) {
        console.error("Erro ao buscar itens da nota:", itemsError);
      }

      // Map invoice_items to the format expected by the frontend NFeData.products
      const products = (items || []).map(item => ({
        code: item.xml_code,
        description: item.xml_description,
        ean: item.xml_ean,
        ncm: item.xml_ncm,
        cfop: item.xml_cfop,
        unit: item.xml_unit,
        quantity: Number(item.quantity),
        unitValue: Number(item.unit_value),
        totalValue: Number(item.total_value)
      }));
      
      return jsonResponse({
        id: inv.id,
        numero: inv.number,
        serie: inv.series,
        issuerName: inv.issuer_name,
        issuerCnpj: inv.issuer_cnpj,
        cnpjFormatado: formatCnpj(inv.issuer_cnpj),
        totalValue: inv.total_value,
        dataEmissao: inv.imported_at,
        fonte: "banco_dados",
        partialData: false,
        products: products 
      });
    }

    // CASE 2: SEARCH BY ACCESS KEY (44 DIGITS)
    const cleanChave = chave.replace(/\s/g, "");
    if (cleanChave.length === 44) {
      try {
        const metadata = parseChaveAcesso(cleanChave);

        // Validate model (55 = NF-e, 65 = NFC-e)
        if (metadata.modelo !== "55" && metadata.modelo !== "65") {
          return jsonResponse({ error: "Chave não corresponde a uma NF-e ou NFC-e válida (modelo 55 ou 65)." }, 400);
        }

        const ano = 2000 + parseInt(metadata.anoMes.substring(0, 2));
        const mes = parseInt(metadata.anoMes.substring(2, 4));
        const dataEmissao = `${ano}-${String(mes).padStart(2, "0")}-01`;

        const nfeNumber = metadata.numero.replace(/^0+/, "") || "0";

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
          partialReason: "Consulta por chave retorna dados básicos. Para importar itens, utilize o arquivo XML.",
        };

        return jsonResponse(result);
      } catch (err) {
        return jsonResponse({ error: (err as Error).message }, 400);
      }
    }

    return jsonResponse({ error: "Formato de chave ou número inválido." }, 400);

  } catch (err) {
    console.error("Erro inesperado na consulta NF-e:", err);
    return jsonResponse({ 
      error: "Ocorreu um erro interno ao processar sua solicitação. Tente novamente em instantes." 
    }, 500);
  }
});