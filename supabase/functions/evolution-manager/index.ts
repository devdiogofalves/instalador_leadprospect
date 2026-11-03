import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function getEvolutionConfig(admin: any) {
  const { data } = await admin.from("evolution_config").select("*").limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const config = await getEvolutionConfig(admin);
  if (!config?.url || !config?.api_key) {
    return json({ error: "Evolution API não configurada. Configure em /admin → Evolution." }, 400);
  }

  const evoUrl = config.url.replace(/\/$/, "");
  const evoKey = config.api_key;

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const instanceName = body.instanceName || body.instance_name || body.instance || body.whatsappInstanceId;

  try {
    // Create instance
    if (action === "create") {
      const name = instanceName;
      if (!name) return json({ error: "instanceName obrigatório" }, 400);
      const r = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.message || data?.error || "Erro ao criar instância" }, r.status);

      // Auto-configure webhook
      const secret = Deno.env.get("WEBHOOK_QUALIFICATION_SECRET") ?? "";
      if (secret) {
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-qualification/${user.id}?token=${secret}`;
        await fetch(`${evoUrl}/webhook/set/${name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              webhook_base64: false,
              events: ["MESSAGES_UPSERT"],
            },
          }),
        }).catch(() => {});
      }

      return json({ ok: true, instance: name, instanceName: name, ...data });
    }

    // Get QR code
    if (action === "qr") {
      const name = instanceName || body.instance;
      const r = await fetch(`${evoUrl}/instance/connect/${name}`, {
        method: "GET",
        headers: { apikey: evoKey },
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.message || "Erro ao gerar QR" }, r.status);
      return json({ base64: data?.base64, qrcode: data, ...data });
    }

    // Get status
    if (action === "status") {
      const name = instanceName || body.instance;
      const r = await fetch(`${evoUrl}/instance/connectionState/${name}`, {
        method: "GET",
        headers: { apikey: evoKey },
      });
      const data = await r.json();
      if (!r.ok) return json({ state: "not_found", instance: name });
      const state = data?.instance?.state || data?.state || "unknown";
      return json({ state, instance: name });
    }

    // Delete instance
    if (action === "delete") {
      const name = instanceName || body.instance;
      const r = await fetch(`${evoUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: evoKey },
      });
      const data = await r.json().catch(() => ({}));
      return json({ ok: r.ok, ...data });
    }

    // List groups
    if (action === "groups") {
      const name = instanceName || body.instance;
      const r = await fetch(`${evoUrl}/group/fetchAllGroups/${name}?getParticipants=false`, {
        method: "GET",
        headers: { apikey: evoKey },
      });
      const data = await r.json();
      if (!r.ok) return json({ groups: [], empty_reason: data?.message || "Erro ao listar grupos" });
      const groups = (Array.isArray(data) ? data : data?.groups || []).map((g: any) => ({
        jid: g.id || g.jid,
        name: g.subject || g.name,
      }));
      return json({ groups });
    }

    // Pairing code
    if (action === "pairing") {
      const name = instanceName || body.instance;
      const phone = body.phone;
      const r = await fetch(`${evoUrl}/instance/connect/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: phone }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: data?.message || "Erro ao gerar código" }, r.status);
      return json({ pairingCode: data?.pairingCode || data?.code, ...data });
    }

    if (action === "test_send") {
      const name = instanceName || body.instance;
      const phone = body.phone;
      const r = await fetch(`${evoUrl}/message/sendText/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: phone, text: "Mensagem de teste do LeadsBooster ✅" }),
      });
      const data = await r.json();
      return json({ ok: r.ok, response: data });
    }

    // List instances
    if (action === "list") {
      const r = await fetch(`${evoUrl}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: evoKey },
      });
      const data = await r.json();
      if (!r.ok) return json({ instances: [] });
      const instances = (Array.isArray(data) ? data : []).map((inst: any) => ({
        id: inst.instance?.instanceName || inst.name,
        instance_name: inst.instance?.instanceName || inst.name,
        status: inst.instance?.state || inst.state || "unknown",
        active: true,
        paused: false,
        daily_limit: 20,
        last_used_at: null,
      }));
      return json({ instances });
    }

    // Auto reconnect
    if (action === "auto_reconnect") {
      const name = instanceName || body.instance;
      const r = await fetch(`${evoUrl}/instance/connect/${name}`, {
        method: "GET",
        headers: { apikey: evoKey },
      });
      const data = await r.json();
      return json({ state: data?.instance?.state || data?.state || "unknown", needsQr: !data?.base64 && !data?.qrcode });
    }

    // Update (pause/resume/limit) - store in DB
    if (action === "update") {
      // For now, just return ok - Evolution doesn't have pause/resume per instance
      return json({ ok: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
