import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface Settings {
  network: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
  updatedByEmail: string | null;
}

interface PendingDeposit {
  id: string;
  method: "momo" | "binance_pay";
  reference: string;
  amountGhs: string;
  network: string | null;
  senderName: string;
  senderNumber: string | null;
  senderBinanceId: string | null;
  senderEmail: string | null;
  createdAt: string;
  userEmail: string;
  userFullName: string;
}

interface BinancePayAccount {
  id: string;
  binanceId: string;
  label: string;
  isActive: boolean;
}

const NETWORKS = ["mtn", "vodafone", "telecel", "airteltigo"];

interface DepositMethods {
  momoEnabled: boolean;
  cryptoEnabled: boolean;
  chatEnabled: boolean;
  binancePayEnabled: boolean;
}

const METHOD_OPTIONS: { key: keyof DepositMethods; label: string; hint: string }[] = [
  {
    key: "momoEnabled",
    label: "Mobile Money",
    hint: "Manual MoMo deposit with payment screenshot and review",
  },
  {
    key: "cryptoEnabled",
    label: "USDT (Crypto)",
    hint: "Automatic crypto deposits via NOWPayments",
  },
  {
    key: "binancePayEnabled",
    label: "Binance Pay",
    hint: "Manual Binance Pay deposit into an admin's registered ID, with review",
  },
  {
    key: "chatEnabled",
    label: "Live Chat",
    hint: "User arranges the top-up with an admin in live chat",
  },
];

export function AdminDepositsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ network: "mtn", accountName: "", accountNumber: "" });
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<DepositMethods>({
    momoEnabled: true,
    cryptoEnabled: true,
    chatEnabled: true,
    binancePayEnabled: true,
  });
  const [savingMethods, setSavingMethods] = useState(false);
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [binanceAccount, setBinanceAccount] = useState<BinancePayAccount | null>(null);
  const [binanceForm, setBinanceForm] = useState({ binanceId: "", label: "" });
  const [savingBinance, setSavingBinance] = useState(false);
  const [removingBinance, setRemovingBinance] = useState(false);

  const fetchAll = async (p = page) => {
    try {
      setLoading(true);
      const [settingsRes, methodsRes, pendingRes, binanceRes] = await Promise.all([
        api.get("/api/admin/deposit-settings"),
        api.get("/api/admin/deposit-methods"),
        api.get(`/api/admin/manual-deposits/pending?page=${p}`),
        api.get("/api/admin/binance-pay-account"),
      ]);
      setSettings(settingsRes.data.data);
      if (settingsRes.data.data) {
        setForm({
          network: settingsRes.data.data.network,
          accountName: settingsRes.data.data.accountName,
          accountNumber: settingsRes.data.data.accountNumber,
        });
      }
      setMethods(methodsRes.data.data);
      setPending(pendingRes.data.data);
      setTotal(pendingRes.data.total);
      setPage(p);
      setBinanceAccount(binanceRes.data.data);
      if (binanceRes.data.data) {
        setBinanceForm({
          binanceId: binanceRes.data.data.binanceId,
          label: binanceRes.data.data.label,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load deposit data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(1);
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

  async function handleSaveBinanceAccount() {
    if (!binanceForm.binanceId.trim() || !binanceForm.label.trim()) {
      toast.error("Enter both a label and your Binance Pay ID");
      return;
    }
    try {
      setSavingBinance(true);
      const { data } = await api.put("/api/admin/binance-pay-account", binanceForm);
      setBinanceAccount(data.data);
      toast.success("Binance Pay ID saved");
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to save Binance Pay ID");
    } finally {
      setSavingBinance(false);
    }
  }

  async function handleRemoveBinanceAccount() {
    if (!window.confirm("Remove your Binance Pay ID? Investors will no longer see it.")) {
      return;
    }
    try {
      setRemovingBinance(true);
      await api.delete("/api/admin/binance-pay-account");
      setBinanceAccount(null);
      setBinanceForm({ binanceId: "", label: "" });
      toast.success("Binance Pay ID removed");
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to remove Binance Pay ID");
    } finally {
      setRemovingBinance(false);
    }
  }

  async function handleSaveMethods(next: DepositMethods) {
    const previous = methods;
    setMethods(next);
    try {
      setSavingMethods(true);
      await api.put("/api/admin/deposit-methods", next);
      toast.success("Payment methods updated");
    } catch (error: any) {
      setMethods(previous);
      toast.error(error.response?.data?.error ?? "Failed to update payment methods");
    } finally {
      setSavingMethods(false);
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
            Visible Payment Methods
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Choose which top-up methods users can pick on the wallet Deposit tab.
            Changes apply immediately.
          </p>
          <div className="space-y-3">
            {METHOD_OPTIONS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition hover:border-primary/30"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{label}</p>
                  <p className="text-xs text-ink-500">{hint}</p>
                </div>
                <input
                  type="checkbox"
                  checked={methods[key]}
                  disabled={savingMethods}
                  onChange={(e) =>
                    handleSaveMethods({ ...methods, [key]: e.target.checked })
                  }
                  className="h-5 w-5 accent-primary"
                />
              </label>
            ))}
          </div>
        </div>

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
                placeholder="InfoPay Ltd"
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

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            My Binance Pay ID
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            Investors who choose Binance Pay see a list of every admin's active
            ID and pick one to pay into. You can register at most one.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink-700">
                Display label (shown to investors)
              </label>
              <input
                value={binanceForm.label}
                onChange={(e) => setBinanceForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                placeholder="e.g. Support Team A"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Your Binance Pay ID</label>
              <input
                value={binanceForm.binanceId}
                onChange={(e) =>
                  setBinanceForm((f) => ({ ...f, binanceId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                placeholder="123456789"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSaveBinanceAccount}
              disabled={savingBinance}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingBinance ? "Saving..." : binanceAccount ? "Update" : "Save"}
            </button>
            {binanceAccount && (
              <button
                onClick={handleRemoveBinanceAccount}
                disabled={removingBinance}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {removingBinance ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Pending Review ({total})
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
                      Method
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
                      <td className="px-4 py-3 text-sm text-ink-700">
                        {d.method === "binance_pay" ? "Binance Pay" : d.network?.toUpperCase()}
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

          {pending.length > 0 && (
            <Pagination
              page={page}
              limit={limit}
              total={total}
              itemCount={pending.length}
              onPageChange={fetchAll}
              itemLabel="pending deposits"
            />
          )}
        </div>
      </div>
    </div>
  );
}
