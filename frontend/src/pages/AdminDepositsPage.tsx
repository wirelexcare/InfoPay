import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Settings {
  network: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
  updatedByEmail: string | null;
}

interface PendingDeposit {
  id: string;
  reference: string;
  amountGhs: string;
  network: string;
  senderName: string;
  senderNumber: string;
  createdAt: string;
  userEmail: string;
  userFullName: string;
}

const NETWORKS = ["mtn", "vodafone", "telecel", "airteltigo"];

export function AdminDepositsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ network: "mtn", accountName: "", accountNumber: "" });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [settingsRes, pendingRes] = await Promise.all([
        api.get("/api/admin/deposit-settings"),
        api.get("/api/admin/manual-deposits/pending"),
      ]);
      setSettings(settingsRes.data.data);
      if (settingsRes.data.data) {
        setForm({
          network: settingsRes.data.data.network,
          accountName: settingsRes.data.data.accountName,
          accountNumber: settingsRes.data.data.accountNumber,
        });
      }
      setPending(pendingRes.data.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load deposit data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleSaveSettings() {
    try {
      setSaving(true);
      await api.post("/api/admin/deposit-settings", form);
      toast.success("Deposit settings saved");
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-6">Mobile Money Deposits</h1>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Receiving Account
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Clients are shown these details and asked to pay here, quoting
            the reference we generate for their deposit.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-ink-700">Network</label>
              <select
                value={form.network}
                onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              >
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Account name</label>
              <input
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                placeholder="AfriHome Ltd"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Number</label>
              <input
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                placeholder="0240000000"
              />
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {settings?.updatedByEmail && (
            <p className="mt-2 text-xs text-ink-400">
              Last set by {settings.updatedByEmail} ·{" "}
              {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Pending Review ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-ink-600">No pending deposits.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-ink-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Network
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Requested
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/admin/deposits/${d.id}`)}
                      className="cursor-pointer border-b border-border/50 hover:bg-ink-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-ink-900">
                          {d.userFullName}
                        </div>
                        <div className="text-xs text-ink-500">{d.userEmail}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-900">
                        ₵{parseFloat(d.amountGhs).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-ink-700">
                        {d.reference}
                      </td>
                      <td className="px-4 py-3 text-sm uppercase text-ink-700">
                        {d.network}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
