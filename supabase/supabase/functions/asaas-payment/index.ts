import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";


const ASAAS_API_URL = "https://api.asaas.com/v3";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create-customer") {
      return await createCustomer(body, supabaseAdmin, userId, ASAAS_API_KEY);
    } else if (action === "create-subscription") {
      return await createSubscription(body, supabaseAdmin, userId, ASAAS_API_KEY);
    } else if (action === "create-payment") {
      return await createPayment(body, supabaseAdmin, userId, ASAAS_API_KEY);
    } else if (action === "cancel-subscription") {
      return await cancelSubscription(body, supabaseAdmin, userId, ASAAS_API_KEY);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Asaas payment error:", error);
    return new Response(JSON.stringify({ error: "Internal error processing payment" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function createCustomer(
  body: { name: string; cpfCnpj: string; email?: string; phone?: string },
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string
) {
  const { name, cpfCnpj, email, phone } = body;

  if (!name || typeof name !== "string" || name.length < 2 || name.length > 200) {
    return new Response(JSON.stringify({ error: "Nome inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!cpfCnpj || typeof cpfCnpj !== "string" || cpfCnpj.replace(/\D/g, "").length < 11) {
    return new Response(JSON.stringify({ error: "CPF/CNPJ inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      name,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      email: email || undefined,
      phone: phone || undefined,
      externalReference: userId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Asaas create customer error:", JSON.stringify(data));
    return new Response(JSON.stringify({ error: "Erro ao criar cliente no gateway" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ customerId: data.id }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function createSubscription(
  body: {
    customerId: string;
    planSlug: string;
    billingType: string;
    companyId: string;
  },
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string
) {
  const { customerId, planSlug, billingType, companyId } = body;

  if (!customerId || !planSlug || !billingType || !companyId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const allowedBillingTypes = ["BOLETO", "CREDIT_CARD", "PIX"];
  if (!allowedBillingTypes.includes(billingType)) {
    return new Response(JSON.stringify({ error: "Método de pagamento inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Verify company membership
  const { data: memberCheck } = await supabaseAdmin.rpc("is_company_member", {
    _user_id: userId,
    _company_id: companyId,
  });
  if (!memberCheck) {
    return new Response(JSON.stringify({ error: "Not a company member" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Get plan details
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("slug", planSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan || plan.price <= 0) {
    return new Response(JSON.stringify({ error: "Plano inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: companyCheck } = await supabaseAdmin
    .from("companies")
    .select("is_courtesy")
    .eq("id", companyId)
    .maybeSingle();

  if (companyCheck?.is_courtesy) {
    const { data: premiumPlan } = await supabaseAdmin
      .from("plans")
      .select("id, price, name, slug")
      .eq("slug", "premium")
      .eq("is_active", true)
      .maybeSingle();

    const planToApply = premiumPlan || plan;
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        company_id: companyId,
        plan_id: planToApply.id,
        asaas_customer_id: customerId,
        asaas_subscription_id: null,
        status: "active",
        payment_method: null,
        billing_type: "COURTESY",
        value: 0,
        next_due_date: null,
      })
      .select()
      .maybeSingle();

    if (insertErr) console.error("DB insert error (courtesy):", insertErr);

    await supabaseAdmin
      .from("companies")
      .update({ plan_id: planToApply.id })
      .eq("id", companyId);

    await supabaseAdmin.from("payment_logs").insert({
      company_id: companyId,
      event_type: "COURTESY_GRANTED",
      status: "courtesy",
      value: 0,
      payment_method: null,
      raw_data: { granted_by: userId, note: "Courtesy grant - no billing performed" },
    });

    return new Response(
      JSON.stringify({ subscriptionId: inserted?.id || null, invoiceUrl: null }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Create subscription in Asaas
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);
  const dueDateStr = nextDueDate.toISOString().split("T")[0];

  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: plan.price,
      nextDueDate: dueDateStr,
      cycle: "MONTHLY",
      description: `Assinatura plano ${plan.name}`,
      externalReference: companyId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Asaas create subscription error:", JSON.stringify(data));
    return new Response(JSON.stringify({ error: "Erro ao criar assinatura" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Save subscription in our DB
  const { error: dbError } = await supabaseAdmin.from("subscriptions").insert({
    company_id: companyId,
    plan_id: plan.id,
    asaas_customer_id: customerId,
    asaas_subscription_id: data.id,
    status: "active",
    payment_method: billingType,
    billing_type: "MONTHLY",
    value: plan.price,
    next_due_date: dueDateStr,
  });

  if (dbError) {
    console.error("DB insert error:", dbError);
  }

  // Update company plan
  await supabaseAdmin
    .from("companies")
    .update({ plan_id: plan.id })
    .eq("id", companyId);

  return new Response(
    JSON.stringify({
      subscriptionId: data.id,
      invoiceUrl: data.invoiceUrl || null,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

async function createPayment(
  body: {
    customerId: string;
    planSlug: string;
    billingType: string;
    companyId: string;
  },
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string
) {
  const { customerId, planSlug, billingType, companyId } = body;

  if (!customerId || !planSlug || !billingType || !companyId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const allowedBillingTypes = ["BOLETO", "CREDIT_CARD", "PIX"];
  if (!allowedBillingTypes.includes(billingType)) {
    return new Response(JSON.stringify({ error: "Método de pagamento inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: memberCheck } = await supabaseAdmin.rpc("is_company_member", {
    _user_id: userId,
    _company_id: companyId,
  });
  if (!memberCheck) {
    return new Response(JSON.stringify({ error: "Not a company member" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("slug", planSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan || plan.price <= 0) {
    return new Response(JSON.stringify({ error: "Plano inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: companyCheckForPayment } = await supabaseAdmin
    .from("companies")
    .select("is_courtesy")
    .eq("id", companyId)
    .maybeSingle();

  if (companyCheckForPayment?.is_courtesy) {
    const { data: premiumPlan } = await supabaseAdmin
      .from("plans")
      .select("id, price, name, slug")
      .eq("slug", "premium")
      .eq("is_active", true)
      .maybeSingle();

    const planToApply = premiumPlan || plan;
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        company_id: companyId,
        plan_id: planToApply.id,
        asaas_customer_id: customerId,
        asaas_payment_id: null,
        status: "active",
        payment_method: null,
        billing_type: "COURTESY",
        value: 0,
        next_due_date: null,
      })
      .select()
      .maybeSingle();

    if (insertErr) console.error("DB insert error (courtesy payment):", insertErr);

    await supabaseAdmin
      .from("companies")
      .update({ plan_id: planToApply.id })
      .eq("id", companyId);

    await supabaseAdmin.from("payment_logs").insert({
      company_id: companyId,
      event_type: "COURTESY_GRANTED",
      status: "courtesy",
      value: 0,
      payment_method: null,
      raw_data: { granted_by: userId, note: "Courtesy grant - no billing performed" },
    });

    return new Response(
      JSON.stringify({
        paymentId: inserted?.id || null,
        invoiceUrl: null,
        bankSlipUrl: null,
        pixQrCode: null,
        pixCopyPaste: null,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const response = await fetch(`${ASAAS_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: plan.price,
      dueDate: dueDateStr,
      description: `Pagamento plano ${plan.name}`,
      externalReference: companyId,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Asaas create payment error:", JSON.stringify(data));
    return new Response(JSON.stringify({ error: "Erro ao gerar cobrança" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Save in DB
  await supabaseAdmin.from("subscriptions").insert({
    company_id: companyId,
    plan_id: plan.id,
    asaas_customer_id: customerId,
    asaas_payment_id: data.id,
    status: "pending",
    payment_method: billingType,
    billing_type: "ONE_TIME",
    value: plan.price,
    next_due_date: dueDateStr,
  });

  return new Response(
    JSON.stringify({
      paymentId: data.id,
      invoiceUrl: data.invoiceUrl || null,
      bankSlipUrl: data.bankSlipUrl || null,
      pixQrCode: data.pixQrCodeBase64 || null,
      pixCopyPaste: data.pixCopiaECola || null,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

async function cancelSubscription(
  body: { companyId: string },
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string
) {
  const { companyId } = body;

  if (!companyId || typeof companyId !== "string") {
    return new Response(JSON.stringify({ error: "Missing companyId" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Verify company membership
  const { data: memberCheck } = await supabaseAdmin.rpc("is_company_member", {
    _user_id: userId,
    _company_id: companyId,
  });
  if (!memberCheck) {
    return new Response(JSON.stringify({ error: "Not a company member" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Verify user is the company owner
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle();

  if (!company || company.owner_id !== userId) {
    return new Response(JSON.stringify({ error: "Apenas o proprietário pode cancelar a assinatura" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Find active subscription
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["active", "pending", "overdue"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return new Response(JSON.stringify({ error: "Nenhuma assinatura ativa encontrada" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Cancel in Asaas if there's a subscription ID
  if (subscription.asaas_subscription_id) {
    const response = await fetch(
      `${ASAAS_API_URL}/subscriptions/${subscription.asaas_subscription_id}`,
      {
        method: "DELETE",
        headers: { access_token: apiKey },
      }
    );
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Asaas cancel error:", JSON.stringify(errData));
      return new Response(JSON.stringify({ error: "Erro ao cancelar assinatura no gateway" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  // Update subscription status in DB
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", subscription.id);

  // Downgrade company to free plan
  const { data: freePlan } = await supabaseAdmin
    .from("plans")
    .select("id")
    .eq("slug", "free")
    .maybeSingle();

  if (freePlan) {
    await supabaseAdmin
      .from("companies")
      .update({ plan_id: freePlan.id })
      .eq("id", companyId);
  }

  // Log the cancellation
  await supabaseAdmin.from("payment_logs").insert({
    company_id: companyId,
    event_type: "SUBSCRIPTION_CANCELLED",
    status: "cancelled",
    subscription_id: subscription.id,
    value: subscription.value,
    payment_method: subscription.payment_method,
  });

  // Audit log
  await supabaseAdmin.from("company_audit_log").insert({
    company_id: companyId,
    user_id: userId,
    action: "subscription_cancelled",
    details: { subscription_id: subscription.id, plan_id: subscription.plan_id },
  });

  return new Response(JSON.stringify({ cancelled: true }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
}
