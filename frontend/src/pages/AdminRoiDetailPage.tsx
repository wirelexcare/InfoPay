import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Payout {
  id: string;
  amountGhs: string;
  status: string;
  scheduledFor: string;
  paidAt: string | null;
  isManual: boolean;
  note: string | null;
  createdAt: string;
}

interface RoiDetail {
  id: string;
  amountGhs: string;
  createdAt: string;
  projectTitle: string;
  expectedReturnPct: string;
  durationDays: string;
  user: { id: string; fullName: string; phone: string } | null;
  dailyAmount: number;
  expectedPaid: number;
  paidSoFar: number;
  discrepancy: number;
  payoutHistory: Payout[];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-900 text-right">{value ?? "—"}</span>
    </div>
  );
}

export function AdminRoiDetailPage() {
  const { investmentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<RoiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/roi/investments/${investmentId}`);
      setData(res.data.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load investment ROI detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [investmentId]);

  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(`/api/admin/roi/investments/${investmentId}/adjust`, {
        amountGhs: amount,
        reason,
      });
      toast.success("Adjustment applied");
      setAmount("");
      setReason("");
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to apply adjustment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-ink-600">Investment not found.</p>
        </div>
      </div>
    );
  }

  const flagged = Math.abs(data.discrepancy) > data.dailyAmount;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/admin/roi")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Reconciliation
        </button>

        <h1 className="text-2xl font-bold text-ink-900 mb-1">{data.projectTitle}</h1>
        {data.user && (
          <p className="text-sm text-ink-500 mb-6">
            {data.user.fullName} · {data.user.phone}
          </p>
        )}

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">
            Reconciliation
          </h2>
          <Row label="Invested" value={`₵${parseFloat(data.amountGhs).toFixed(2)}`} />
          <Row label="Expected Return" value={`${data.expectedReturnPct}%`} />
          <Row label="Duration" value={`${data.durationDays} days`} />
          <Row label="Daily ROI" value={`₵${data.dailyAmount.toFixed(2)}`} />
          <Row label="Expected Paid to Date" value={`₵${data.expectedPaid.toFixed(2)}`} />
          <Row label="Actually Paid" value={`₵${data.paidSoFar.toFixed(2)}`} />
          <Row
            label="Discrepancy"
            value={
              <span
                className={
                  flagged ? "flex items-center gap-1.5 text-amber-700" : "text-ink-900"
                }
              >
                {flagged && <AlertTriangle size={14} />}₵{data.discrepancy.toFixed(2)}
              </span>
            }
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Manual Adjustment
          </h2>
          <form onSubmit={handleAdjust} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-ink-700">
                Amount (GHS) — positive to credit, negative to debit
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 25.00 or -10.00"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">Reason</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Backfill for missed accrual on 2026-07-18"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Applying..." : "Apply Adjustment"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Payout History ({data.payoutHistory.length})
          </h2>
          {data.payoutHistory.length === 0 ? (
            <p className="text-sm text-ink-600">No payouts yet.</p>
          ) : (
            <div className="space-y-2">
              {data.payoutHistory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div>
                    <span className="text-sm font-semibold text-ink-900">
                      ₵{parseFloat(p.amountGhs).toFixed(2)}
                    </span>
                    {p.isManual && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Manual
                      </span>
                    )}
                    {p.note && <p className="text-xs text-ink-500 mt-0.5">{p.note}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-500 capitalize">{p.status}</div>
                    <div className="text-xs text-ink-400">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
