import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AmountField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase text-ink-500">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
      />
    </div>
  );
}

export function AdminPaymentSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [minDeposit, setMinDeposit] = useState("");
  const [maxDeposit, setMaxDeposit] = useState("");
  const [depositFee, setDepositFee] = useState("0");
  const [cryptoMinDeposit, setCryptoMinDeposit] = useState("");
  const [cryptoMaxDeposit, setCryptoMaxDeposit] = useState("");
  const [binanceMinDeposit, setBinanceMinDeposit] = useState("");
  const [binanceMaxDeposit, setBinanceMaxDeposit] = useState("");
  const [binanceDepositFee, setBinanceDepositFee] = useState("0");
  const [minWithdrawal, setMinWithdrawal] = useState("");
  const [maxWithdrawal, setMaxWithdrawal] = useState("");
  const [withdrawalFee, setWithdrawalFee] = useState("0");
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    api
      .get("/api/admin/payment-settings")
      .then(({ data }) => {
        const d = data.data;
        setMinDeposit(d.momoMinDepositGhs ?? "");
        setMaxDeposit(d.momoMaxDepositGhs ?? "");
        setDepositFee(String(Number(d.momoDepositFeePct ?? 0)));
        setCryptoMinDeposit(d.cryptoMinDepositGhs ?? "");
        setCryptoMaxDeposit(d.cryptoMaxDepositGhs ?? "");
        setBinanceMinDeposit(d.binanceMinDepositGhs ?? "");
        setBinanceMaxDeposit(d.binanceMaxDepositGhs ?? "");
        setBinanceDepositFee(String(Number(d.binanceDepositFeePct ?? 0)));
        setMinWithdrawal(d.minWithdrawalGhs ?? "");
        setMaxWithdrawal(d.maxWithdrawalGhs ?? "");
        setWithdrawalFee(String(Number(d.withdrawalFeePct ?? 0)));
        setDays(d.withdrawalDays ?? []);
        setStartTime(d.withdrawalStartTime ?? "");
        setEndTime(d.withdrawalEndTime ?? "");
      })
      .catch(() => toast.error("Failed to load payment settings"))
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSave() {
    try {
      setSaving(true);
      await api.put("/api/admin/payment-settings", {
        momoMinDepositGhs: minDeposit,
        momoMaxDepositGhs: maxDeposit,
        momoDepositFeePct: depositFee || "0",
        cryptoMinDepositGhs: cryptoMinDeposit,
        cryptoMaxDepositGhs: cryptoMaxDeposit,
        binanceMinDepositGhs: binanceMinDeposit,
        binanceMaxDepositGhs: binanceMaxDeposit,
        binanceDepositFeePct: binanceDepositFee || "0",
        minWithdrawalGhs: minWithdrawal,
        maxWithdrawalGhs: maxWithdrawal,
        withdrawalFeePct: withdrawalFee || "0",
        withdrawalDays: days,
        withdrawalStartTime: startTime,
        withdrawalEndTime: endTime,
      });
      toast.success("Payment rules saved");
    } catch (err: any) {
      const flat = err.response?.data?.error;
      const msg =
        flat?.formErrors?.[0] ??
        (flat?.fieldErrors && Object.values(flat.fieldErrors).flat()[0]) ??
        "Failed to save payment rules";
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
          <h1 className="text-2xl font-bold text-ink-900">Payment rules</h1>
          <p className="mt-1 text-sm text-ink-500">
            Limits, fees, and withdrawal windows enforced across the platform.
            Leave a limit blank for no limit.
          </p>
        </div>

        {loading ? (
          <div className="h-96 animate-pulse rounded-lg bg-ink-100" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-3 font-bold text-ink-900">Mobile Money Deposits</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <AmountField label="Minimum (GHS)" value={minDeposit} onChange={setMinDeposit} placeholder="No minimum" />
                <AmountField label="Maximum (GHS)" value={maxDeposit} onChange={setMaxDeposit} placeholder="No maximum" />
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">Fee (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={depositFee}
                    onChange={(e) => setDepositFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                The fee is added on top of the deposit: a GHS 100 deposit at 2% requires paying GHS 102, and GHS 100 is credited to the wallet.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-3 font-bold text-ink-900">Crypto Deposits</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <AmountField label="Minimum (GHS)" value={cryptoMinDeposit} onChange={setCryptoMinDeposit} placeholder="No extra minimum" />
                <AmountField label="Maximum (GHS)" value={cryptoMaxDeposit} onChange={setCryptoMaxDeposit} placeholder="No maximum" />
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Crypto deposits never carry a fee. NOWPayments also enforces its own live minimum,
                which moves with the crypto market — these fields only add an optional extra floor/cap
                on top of that.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-3 font-bold text-ink-900">Binance Pay Deposits</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <AmountField label="Minimum (GHS)" value={binanceMinDeposit} onChange={setBinanceMinDeposit} placeholder="No minimum" />
                <AmountField label="Maximum (GHS)" value={binanceMaxDeposit} onChange={setBinanceMaxDeposit} placeholder="No maximum" />
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">Fee (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={binanceDepositFee}
                    onChange={(e) => setBinanceDepositFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                The fee is added on top of the deposit, same as Mobile Money. Manage each
                admin's Binance Pay ID from the Mobile Money Deposits page.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-3 font-bold text-ink-900">Withdrawals</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <AmountField label="Minimum (GHS)" value={minWithdrawal} onChange={setMinWithdrawal} placeholder="No minimum" />
                <AmountField label="Maximum (GHS)" value={maxWithdrawal} onChange={setMaxWithdrawal} placeholder="No maximum" />
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">Fee (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={withdrawalFee}
                    onChange={(e) => setWithdrawalFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                The fee comes out of the requested amount: a GHS 100 withdrawal at 2% pays out GHS 98.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
              <h2 className="mb-1 font-bold text-ink-900">Withdrawal window</h2>
              <p className="mb-4 text-xs text-ink-400">
                Select no days and leave times blank to allow withdrawals anytime.
                Times are GMT (Ghana time).
              </p>

              <label className="text-xs font-semibold uppercase text-ink-500">
                Allowed days {days.length === 0 && "(every day)"}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS.map((label, d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      days.includes(d)
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-ink-500 hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">
                    Open from (GMT)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-ink-500">
                    Open until (GMT)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              {(startTime || endTime) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartTime("");
                    setEndTime("");
                  }}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  Clear times (allow any time of day)
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save payment rules"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
