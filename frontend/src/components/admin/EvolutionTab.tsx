import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function EvolutionTab() {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
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
        .from("evolution_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setUrl(data.url || "");
        setApiKey(data.api_key || "");
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
          .from("evolution_config")
          .update({ url, api_key: apiKey, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("evolution_config")
          .insert({ url, api_key: apiKey })
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }
      toast({ title: "Salvo", description: "Configuração Evolution API atualizada." });
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
          <CheckCircle className="h-5 w-5 text-primary" /> Evolution API — Configuração Global
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a URL e a API Key globais da Evolution API. Os clientes usarão esses dados para conectar e criar instâncias WhatsApp.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="evo-url">URL da Evolution API</Label>
          <Input
            id="evo-url"
            placeholder="http://144.91.94.83:8080"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="evo-key">API Key Global</Label>
          <Input
            id="evo-key"
            type="password"
            placeholder="evolution-api-key-change-me"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <Button onClick={saveConfig} disabled={saving || !url.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Dica:</p>
        <p>A URL deve ser acessível pelos clientes (ex: https://evolution.seudominio.com). A API Key é a <code>AUTHENTICATION_API_KEY</code> do container.</p>
      </div>
    </div>
  );
}
