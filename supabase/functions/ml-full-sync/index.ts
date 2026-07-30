// Edge Function: ml-full-sync
// Sincroniza automaticamente pedidos Full do Mercado Livre, criando registros em full_orders.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ML_API_BASE = "https://api.mercadolibre.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTERVAL_TO_MINUTES: Record<string, number> = {
  "15min": 15,
  "30min": 30,
  "1h": 60,
  "6h": 360,
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // === Body: suporta modo diagnóstico (dryRun) que NÃO cria nada ===
  let dryRun = false;
  let backfillMinutes = 0;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
    backfillMinutes = Number(body?.backfillMinutes ?? 0) || 0;
  } catch (_) {
    // sem body (ex: cron) -> fluxo normal
  }
  // Janela ampla (30 dias) no diagnóstico para encontrar pedidos já existentes
  const DRYRUN_MINUTES = 30 * 24 * 60;

  // === AUTH: CRON_SECRET (cron) ou qualquer usuário autenticado (manual) ===
  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  let expectedCronSecret = Deno.env.get("CRON_SECRET") ?? null;
  if (cronSecret) {
    try {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );
      const { data: vaultSecret } = await svc.rpc("get_cron_secret");
      if (vaultSecret) expectedCronSecret = vaultSecret as unknown as string;
    } catch (_) {}
  }
  const hasCronAuth =
    !!expectedCronSecret && !!cronSecret && cronSecret === expectedCronSecret;

  let requesterUserId: string | null = null;

  if (!hasCronAuth) {
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "A API key foi rejeitada. Confira a chave no setup ou solicite uma nova." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    requesterUserId = claimsData.claims.sub as string;
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Descobre a empresa do solicitante (fluxo manual) e escopa os user_ids
  let allowedUserIds: string[] | null = null;
  if (requesterUserId) {
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", requesterUserId)
      .maybeSingle();
    const requesterCompanyId = requesterProfile?.company_id ?? null;
    if (!requesterCompanyId) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada para o usuário." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: companyProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", requesterCompanyId);
    allowedUserIds = (companyProfiles ?? []).map((p) => p.id as string);
    if (!allowedUserIds.length) {
      return new Response(JSON.stringify({ success: true, synced: 0, errors: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Monta a lista de contas a processar.
  // - Manual/diagnóstico: dirigido por ml_connections ATIVAS da empresa
  //   (uma conta pode estar conectada sem ter linha em ml_settings).
  // - Cron: dirigido por ml_settings com auto_sync_full_orders = true.
  let settingsList: { user_id: string; full_sync_interval: string | null }[] = [];

  if (allowedUserIds) {
    const { data: conns, error: connErr } = await supabase
      .from("ml_connections")
      .select("user_id")
      .in("user_id", allowedUserIds)
      .eq("is_active", true);

    if (connErr) {
      return new Response(JSON.stringify({ error: connErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connUserIds = Array.from(new Set((conns ?? []).map((c) => c.user_id as string)));

    const { data: settingsRows } = await supabase
      .from("ml_settings")
      .select("user_id, full_sync_interval")
      .in("user_id", connUserIds.length ? connUserIds : ["__none__"]);

    const intervalByUser = new Map<string, string | null>(
      (settingsRows ?? []).map((r) => [r.user_id as string, r.full_sync_interval as string | null]),
    );

    settingsList = connUserIds.map((uid) => ({
      user_id: uid,
      full_sync_interval: intervalByUser.get(uid) ?? "15min",
    }));
  } else {
    const { data: settingsRows, error: settingsErr } = await supabase
      .from("ml_settings")
      .select("user_id, full_sync_interval")
      .eq("auto_sync_full_orders", true);

    if (settingsErr) {
      return new Response(JSON.stringify({ error: settingsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    settingsList = (settingsRows ?? []).map((r) => ({
      user_id: r.user_id as string,
      full_sync_interval: r.full_sync_interval as string | null,
    }));
  }

  if (!settingsList.length) {
    return new Response(
      JSON.stringify({
        success: true,
        synced: 0,
        ...(dryRun ? { dryRun: true, diagnostics: [] } : {}),
        message: allowedUserIds
          ? "Nenhuma conta ML ativa encontrada para a empresa."
          : "No active auto-sync users",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let totalSynced = 0;
  let totalErrors = 0;
  const diagnostics: any[] = [];

  for (const s of settingsList) {
    try {
      // Buscar conexão ML do usuário
      const { data: conn } = await supabase
        .from("ml_connections")
        .select("*")
        .eq("user_id", s.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!conn) continue;

      // Buscar company_id via profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", s.user_id)
        .maybeSingle();
      const companyId = profile?.company_id;
      if (!companyId) continue;

      let accessToken = conn.access_token;

      // Refresh token se expirado
      if (conn.refresh_token && new Date(conn.token_expires_at ?? 0) < new Date()) {
        const mlAppId = Deno.env.get("MERCADO_LIVRE_APP_ID");
        const mlSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
        if (!mlAppId || !mlSecret) {
          const missing = [!mlAppId && "MERCADO_LIVRE_APP_ID", !mlSecret && "MERCADO_LIVRE_CLIENT_SECRET"].filter(Boolean).join(", ");
          console.error(`[ml-full-sync] Refresh abortado — secrets faltando: ${missing}`);
          totalErrors++;
          continue;
        }
        const refreshResp = await fetch(`${ML_API_BASE}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: mlAppId,
            client_secret: mlSecret,
            refresh_token: conn.refresh_token,
          }),
        });
        const refreshData = await refreshResp.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          await supabase
            .from("ml_connections")
            .update({
              access_token: accessToken,
              refresh_token: refreshData.refresh_token ?? conn.refresh_token,
              token_expires_at: new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString(),
            })
            .eq("id", conn.id);
        }
      }

      const minutes = dryRun
        ? DRYRUN_MINUTES
        : backfillMinutes > 0
        ? backfillMinutes
        : (INTERVAL_TO_MINUTES[s.full_sync_interval ?? "15min"] ?? 15);
      const sinceDate = new Date(Date.now() - minutes * 60 * 1000).toISOString();

      // NOTA: o filtro shipping.logistic_type não é suportado em /orders/search.
      // Buscamos os pedidos pagos e filtramos "fulfillment" no cliente.
      const ordersUrl = `${ML_API_BASE}/orders/search?seller=${conn.ml_user_id}&order.status=paid&sort=date_desc&limit=50`;
      const mlResp = await fetch(ordersUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const mlStatus = mlResp.status;
      const ordersData = await mlResp.json().catch(() => ({}));

      if (!mlResp.ok) {
        totalErrors++;
        if (dryRun) {
          diagnostics.push({
            user_id: s.user_id,
            seller_id: conn.ml_user_id,
            ml_status: mlStatus,
            ml_error: ordersData?.message || ordersData?.error || "erro desconhecido",
            paging_total: 0,
            total_pagos: 0,
            total_full: 0,
            na_janela_30d: 0,
            ja_no_painel: 0,
            novos_com_vinculo: 0,
            novos_sem_vinculo: 0,
          });
        }
        continue;
      }

      const allOrders: any[] = ordersData.results ?? [];
      const pagingTotal = ordersData?.paging?.total ?? allOrders.length;

      // Busca os detalhes de envio em PARALELO (logistic_type não vem no /orders/search)
      let shipOk = 0;
      let shipFail = 0;
      let shipSampleStatus = 0;
      let shipSampleLogistic = "";
      const shipResults = await Promise.all(
        allOrders.map(async (o: any) => {
          const shipId = o?.shipping?.id;
          if (!shipId) return null;
          try {
            const shipResp = await fetch(`${ML_API_BASE}/shipments/${shipId}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "x-format-new": "true",
              },
            });
            if (!shipResp.ok) {
              shipFail++;
              shipSampleStatus = shipResp.status;
              return null;
            }
            shipOk++;
            const ship = await shipResp.json().catch(() => ({}));
            const lt = ship?.logistic?.type ?? ship?.logistic_type ?? "";
            if (!shipSampleLogistic && lt) shipSampleLogistic = lt;
            if (lt === "fulfillment") {
              o.shipping = { ...o.shipping, logistic_type: lt, id: shipId };
              return o;
            }
            return null;
          } catch (_) {
            shipFail++;
            return null;
          }
        }),
      );
      const orders: any[] = shipResults.filter(Boolean) as any[];

      const relevantOrders = orders.filter((o: any) => {
        const orderDate = o.date_created ?? o.last_updated ?? "";
        return orderDate >= sinceDate;
      });

      // Contadores de diagnóstico (por usuário)
      let dJaExistem = 0;
      let dComVinculo = 0;
      let dSemVinculo = 0;

      for (const order of relevantOrders) {
        const mlOrderId = String(order.id);
        const freightId = String(order.shipping?.id ?? order.id);
        const buyerNickname = order.buyer?.nickname ?? "Comprador";

        // Verificar duplicata por frete_ml + company
        const { data: existing } = await supabase
          .from("full_orders")
          .select("id")
          .eq("frete_ml", freightId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (dryRun) {
          // MODO DIAGNÓSTICO: não cria nada, apenas conta
          if (existing) {
            dJaExistem++;
            continue;
          }
          const orderItems = order.order_items ?? [];
          let temVinculo = false;
          for (const item of orderItems) {
            const mlItemId = String(item.item?.id ?? "");
            const { data: linked } = await supabase
              .from("ml_linked_products")
              .select("product_id")
              .eq("ml_item_id", mlItemId)
              .maybeSingle();
            if (linked?.product_id) {
              temVinculo = true;
              break;
            }
          }
          if (temVinculo) dComVinculo++;
          else dSemVinculo++;
          continue;
        }

        if (existing) continue;

        const orderItems = order.order_items ?? [];
        // Monta bipagem_state com TODOS os itens (vinculados e não)
        const bipagemState: any[] = [];
        const itemsToInsert: any[] = [];
        for (const item of orderItems) {
          const mlItemId = String(item.item?.id ?? "");
          const mlTitle = item.item?.title ?? `Item ML ${mlItemId}`;
          const mlSku = item.item?.seller_sku ?? item.item?.seller_custom_field ?? "";
          const qty = Number(item.quantity ?? 1);
          const { data: linked } = await supabase
            .from("ml_linked_products")
            .select("product_id, products(name, sku, barcode, image_url)")
            .eq("ml_item_id", mlItemId)
            .maybeSingle();
          if (linked?.product_id) {
            itemsToInsert.push({
              order_id: null, // preenchido após criar a ordem
              product_id: linked.product_id,
              quantity: qty,
            });
            bipagemState.push({
              productId: linked.product_id,
              name: (linked as any).products?.name ?? mlTitle,
              sku: (linked as any).products?.sku ?? mlSku,
              barcode: (linked as any).products?.barcode ?? null,
              image_url: (linked as any).products?.image_url ?? null,
              neededQty: qty,
              scannedQty: 0,
              status: "pendente",
            });
          } else {
            // Item sem vínculo: aparece no painel marcado como nao vinculado
            bipagemState.push({
              productId: "",
              name: mlTitle,
              sku: mlSku,
              barcode: null,
              image_url: null,
              neededQty: qty,
              scannedQty: 0,
              status: "sem_vinculo",
            });
          }
        }

        // Cria a full_order SEMPRE (com bipagem_state completo)
        const { data: newOrder, error: insertError } = await supabase
          .from("full_orders")
          .insert({
            company_id: companyId,
            ordem_id: mlOrderId,
            frete_ml: freightId,
            descricao: `Pedido ML ${mlOrderId} - ${buyerNickname}`,
            status: "separacao",
            bipagem_state: bipagemState,
          })
          .select("id")
          .single();
        if (insertError || !newOrder) {
          console.error("Insert full_order error:", insertError);
          continue;
        }

        // === VINCULAR DADOS FINANCEIROS DO PEDIDO ===
        // Busca o ml_order correspondente para copiar dados financeiros
        try {
          const { data: mlOrder } = await supabase
            .from("ml_orders")
            .select("total_amount, shipping_cost, marketplace_fee, date_created")
            .eq("ml_order_id", mlOrderId)
            .eq("company_id", companyId)
            .maybeSingle();

          if (mlOrder) {
            console.log(`[ml-full-sync] Dados financeiros encontrados em ml_orders para pedido ${mlOrderId}:`, {
              total_amount: mlOrder.total_amount,
              shipping_cost: mlOrder.shipping_cost,
              marketplace_fee: mlOrder.marketplace_fee,
            });
            // TODO: Quando a migration for aplicada, copiar estes campos para full_orders:
            // total_amount, shipping_cost, marketplace_fee
          } else {
            // Tenta buscar da API ML e persistir em ml_orders
            console.log(`[ml-full-sync] Pedido ${mlOrderId} não encontrado em ml_orders. Buscando da API ML...`);
            const orderDetailResp = await fetch(`${ML_API_BASE}/orders/${mlOrderId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (orderDetailResp.ok) {
              const orderDetail = await orderDetailResp.json();
              const totalAmount = Number(orderDetail.total_amount ?? 0);
              const shippingCost = Number(orderDetail.shipping?.cost ?? 0);
              const marketplaceFee = Number(orderDetail.fees?.amount ?? 0);

              console.log(`[ml-full-sync] Dados financeiros da API ML para pedido ${mlOrderId}:`, {
                total_amount: totalAmount,
                shipping_cost: shippingCost,
                marketplace_fee: marketplaceFee,
              });

              // Persiste em ml_orders se ainda não existir
              await supabase.from("ml_orders").upsert({
                ml_order_id: mlOrderId,
                company_id: companyId,
                total_amount: totalAmount,
                shipping_cost: shippingCost,
                marketplace_fee: marketplaceFee,
                date_created: orderDetail.date_created ?? new Date().toISOString(),
                status: orderDetail.status ?? "paid",
                buyer_nickname: buyerNickname,
              }).eq("ml_order_id", mlOrderId).eq("company_id", companyId);
            } else {
              console.warn(`[ml-full-sync] Falha ao buscar detalhes do pedido ${mlOrderId} da API ML: ${orderDetailResp.status}`);
            }
          }
        } catch (finErr) {
          console.error(`[ml-full-sync] Erro ao processar dados financeiros do pedido ${mlOrderId}:`, finErr);
        }

        // Insere apenas os itens vinculados (product_id é NOT NULL)
        if (itemsToInsert.length) {
          await supabase
            .from("full_order_items")
            .insert(itemsToInsert.map((it) => ({ ...it, order_id: newOrder.id })));
        }

        // Notificação interna (vinculada ao user_id que possui a conexão)
        await supabase.from("admin_internal_notifications").insert({
          user_id: s.user_id,
          title: "Novo Pedido Full Sincronizado",
          message: `Pedido #${mlOrderId} - ${buyerNickname} foi adicionado automaticamente ao painel.`,
          type: "info",
        });

        totalSynced++;
      }

      if (dryRun) {
        diagnostics.push({
          user_id: s.user_id,
          seller_id: conn.ml_user_id,
          ml_status: mlStatus,
          paging_total: pagingTotal,
          total_pagos: allOrders.length,
          total_full: orders.length,
          na_janela_30d: relevantOrders.length,
          ja_no_painel: dJaExistem,
          novos_com_vinculo: dComVinculo,
          novos_sem_vinculo: dSemVinculo,
          ship_ok: shipOk,
          ship_fail: shipFail,
          ship_sample_status: shipSampleStatus,
          ship_sample_logistic: shipSampleLogistic,
        });
      }
    } catch (err) {
      console.error(`Error syncing user ${s.user_id}:`, err);
      totalErrors++;
    }
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({ success: true, dryRun: true, diagnostics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, synced: totalSynced, errors: totalErrors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
