import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Profile {
  label: string;
  url: string;
}

export function AdminSupportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState("");
  const [telegramGroupUrl, setTelegramGroupUrl] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    api
      .get("/api/admin/support-settings")
      .then(({ data }) => {
        setWhatsappChannelUrl(data.data.whatsappChannelUrl ?? "");
        setTelegramGroupUrl(data.data.telegramGroupUrl ?? "");
        setProfiles(data.data.telegramProfiles ?? []);
      })
      .catch(() => toast.error("Failed to load support settings"))
      .finally(() => setLoading(false));
  }, []);

  function addProfile() {
    if (profiles.length >= 10) {
      toast.error("You can add up to 10 Telegram profile links");
      return;
    }
    setProfiles((p) => [...p, { label: "", url: "" }]);
  }

  function updateProfile(i: number, field: keyof Profile, value: string) {
    setProfiles((p) => p.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)));
  }

  function removeProfile(i: number) {
    setProfiles((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    // Drop empty profile rows before saving.
    const cleanedProfiles = profiles
      .map((p) => ({ label: p.label.trim(), url: p.url.trim() }))
      .filter((p) => p.url);

    try {
      setSaving(true);
      await api.put("/api/admin/support-settings", {
        whatsappChannelUrl: whatsappChannelUrl.trim(),
        telegramGroupUrl: telegramGroupUrl.trim(),
        telegramProfiles: cleanedProfiles,
      });
      setProfiles(cleanedProfiles);
      toast.success("Support settings saved");
    } catch (err: any) {
      const flat = err.response?.data?.error;
      const msg =
        flat?.formErrors?.[0] ??
        (flat?.fieldErrors && Object.values(flat.fieldErrors).flat()[0]) ??
        "Failed to save. Check that all links are valid URLs.";
      toast.error(msg as string);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Support links</h1>
          <p className="mt-1 text-sm text-ink-500">
            Configure the support channels users can reach you on. Only the links
            you fill in are shown, and the support icon appears to users only when
            at least one link is set. Leave a field blank to hide it.
          </p>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-lg bg-ink-100" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">
                    WhatsApp channel link
                  </label>
                  <input
                    value={whatsappChannelUrl}
                    onChange={(e) => setWhatsappChannelUrl(e.target.value)}
                    placeholder="https://whatsapp.com/channel/..."
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">
                    Telegram group link
                  </label>
                  <input
                    value={telegramGroupUrl}
                    onChange={(e) => setTelegramGroupUrl(e.target.value)}
                    placeholder="https://t.me/yourgroup"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-ink-900">Telegram profile links</h2>
                  <p className="text-xs text-ink-500">
                    Up to 10 support contacts ({profiles.length}/10)
                  </p>
                </div>
                <button
                  onClick={addProfile}
                  disabled={profiles.length >= 10}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-40"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              {profiles.length === 0 ? (
                <p className="text-sm text-ink-400">No profile links added.</p>
              ) : (
                <div className="space-y-3">
                  {profiles.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_2fr]">
                        <input
                          value={p.label}
                          onChange={(e) => updateProfile(i, "label", e.target.value)}
                          placeholder="Name (e.g. Support)"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                        />
                        <input
                          value={p.url}
                          onChange={(e) => updateProfile(i, "url", e.target.value)}
                          placeholder="https://t.me/username"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => removeProfile(i)}
                        className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save support links"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
