import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function GoogleOAuthTab() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("google_oauth_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setClientId(data.client_id || "");
        setClientSecret(data.client_secret || "");
        setConfigId(data.id);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from("google_oauth_config")
          .update({ client_id: clientId, client_secret: clientSecret, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("google_oauth_config")
          .insert({ client_id: clientId, client_secret: clientSecret })
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }
      toast({ title: "Salvo", description: "Configuração Google OAuth atualizada." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" /> Google OAuth — Configuração Global
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o Client ID e Client Secret do Google OAuth. Usado para integração com Google Calendar e outros serviços Google.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="google-client-id">Client ID</Label>
          <Input
            id="google-client-id"
            placeholder="123456789-abc.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="google-client-secret">Client Secret</Label>
          <Input
            id="google-client-secret"
            type="password"
            placeholder="GOCSPX-..."
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>
        <Button onClick={saveConfig} disabled={saving || !clientId.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Dica:</p>
        <p>Obtenha as credenciais em <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console → Credenciais</a>. Configure o redirect URI como <code>https://prospecta.contatte.com.br/functions/v1/google-oauth-callback</code>.</p>
      </div>
    </div>
  );
}