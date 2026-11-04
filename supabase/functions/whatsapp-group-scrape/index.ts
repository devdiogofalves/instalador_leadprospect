// Captação de leads via grupos WhatsApp (Evolution API).
// Lista grupos do chip ativo e extrai participantes pra public.whatsapp_group_leads.
//
// POST body:
//   { action: "list-groups" }                       → retorna grupos do chip
//   { action: "scrape", group_jids: ["...@g.us"] }  → raspa membros e grava
//   { action: "scrape-all" }                        → raspa todos os grupos

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (value: unknown) => String(value ?? "").replace(/@.*$/, "").replace(/\D/g, "");

function validPhone(value: unknown) {
  const digits = onlyDigits(value);
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const SUPA = Deno.env.get("SUPABASE_URL")!;
    const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPA, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return json({ error: "Unauthenticated" }, 401);
    const admin = createClient(SUPA, SR);

    const body = await req.json().catch(() => ({} as any));
    const action = body.action ?? "list-groups";

    // Chip ativo (1º criado)
    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("mandrack_instance_token, instance_name")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (!inst?.mandrack_instance_token) {
      return json({ error: "Nenhum chip WhatsApp ativo. Conecte um chip em Integrações → WhatsApp." }, 400);
    }

    const evoUrl = Deno.env.get("EVOLUTION_API_URL") ?? "http://evolution-api:8080";
    const evoKey = inst.mandrack_instance_token;
    const instance = inst.instance_name;

    async function evoFetch(path: string) {
      const r = await fetch(`${evoUrl}${path}`, {
        headers: { apikey: evoKey, "Content-Type": "application/json" },
      });
      const t = await r.text();
      let b: any = t; try { b = JSON.parse(t); } catch {}
      return { ok: r.ok, status: r.status, body: b };
    }

    if (action === "list-groups") {
      const r = await evoFetch(`/group/fetchAllGroups/${instance}?getParticipants=false`);
      const raw = Array.isArray(r.body) ? r.body : (r.body?.groups ?? []);
      const groups = (Array.isArray(raw) ? raw : []).map((g: any) => ({
        jid: String(g.id ?? g.jid ?? ""),
        name: String(g.subject ?? g.name ?? g.title ?? ""),
        size: g.size ?? null,
      })).filter((g: any) => g.jid.endsWith("@g.us"));
      return json({ groups });
    }

    // Resolve lista de grupos alvo
    let targetJids: string[] = [];
    if (action === "scrape-all") {
      const r = await evoFetch(`/group/fetchAllGroups/${instance}?getParticipants=false`);
      const raw = Array.isArray(r.body) ? r.body : (r.body?.groups ?? []);
      targetJids = (Array.isArray(raw) ? raw : []).map((g: any) => String(g.id ?? g.jid ?? "")).filter((j: string) => j.endsWith("@g.us"));
    } else if (action === "scrape") {
      targetJids = Array.isArray(body.group_jids) ? body.group_jids.map(String) : [];
    } else {
      return json({ error: "action inválido" }, 400);
    }
    if (targetJids.length === 0) return json({ error: "nenhum grupo selecionado" }, 400);

    let totalMembers = 0;
    let totalSaved = 0;
    const perGroup: any[] = [];

    for (const jid of targetJids) {
      const r = await evoFetch(`/group/participants/${instance}?groupJid=${encodeURIComponent(jid)}`);
      const participants = r.body?.participants ?? [];
      const groupName = r.body?.subject ?? "";

      if (participants.length === 0) {
        perGroup.push({ jid, saved: 0, reason: "sem participantes ou sem permissão de admin" });
        continue;
      }

      let groupSaved = 0;
      for (const p of participants) {
        totalMembers++;
        const phone = validPhone(p.phoneNumber ?? p.id);
        if (!phone) continue;

        const { error } = await admin.from("whatsapp_group_leads").upsert({
          user_id: userId,
          group_jid: jid,
          group_name: groupName,
          telefone: phone,
          nome: p.name ?? null,
          is_admin: p.admin === "admin" || p.admin === "superadmin",
          member_jid: p.id ?? null,
        }, { onConflict: "user_id,group_jid,member_jid" });

        if (!error) {
          groupSaved++;
          totalSaved++;
        }
      }
      perGroup.push({ jid, name: groupName, members: participants.length, saved: groupSaved });
    }

    return json({ totalMembers, saved: totalSaved, groups: perGroup.length, perGroup });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
