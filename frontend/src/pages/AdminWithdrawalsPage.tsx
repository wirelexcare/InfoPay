import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Withdrawal {
  id: string;
  userId: string;
  amountGhs: string;
  method: string | null;
  status: string;
  createdAt: string;
  user?: { email: string; fullName: string };
  withdrawalMethod?: { accountName: string; accountNumber: string | null } | null;
}

export function AdminWithdrawalsPage() {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/withdrawals/pending");
      setWithdrawals(res.data.data);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
      toast.error("Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (txnId: string) => {
    try {
      setActingOn(txnId);
      await api.post(`/api/admin/withdrawals/${txnId}/approve`);
      toast.success("Withdrawal approved");
      setWithdrawals((prev) => prev.filter((w) => w.id !== txnId));
    } catch (error) {
      toast.error("Error approving withdrawal");
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (txnId: string) => {
    try {
      setActingOn(txnId);
      await api.post(`/api/admin/withdrawals/${txnId}/reject`, {
        reason: "Rejected by admin",
      });
      toast.success("Withdrawal rejected and refunded");
      setWithdrawals((prev) => prev.filter((w) => w.id !== txnId));
    } catch (error) {
      toast.error("Error rejecting withdrawal");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Pending Withdrawals</h1>
          <div className="rounded-full bg-amber-50 px-4 py-2 font-bold text-amber-700">
            {withdrawals.length} pending
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-lg font-medium text-ink-900">All set!</p>
            <p className="text-ink-600">No pending withdrawals.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-ink-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Requested
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/50 hover:bg-ink-50/50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-ink-900">
                        {w.user?.fullName || "Unknown"}
                      </div>
                      <div className="text-xs text-ink-500">{w.user?.email}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-ink-900">
                      ₵{parseFloat(w.amountGhs).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-700">
                      <div className="capitalize">{w.method || "—"}</div>
                      {w.withdrawalMethod && (
                        <div className="text-xs text-ink-500">
                          {w.withdrawalMethod.accountName}
                          {w.withdrawalMethod.accountNumber &&
                            ` · ${w.withdrawalMethod.accountNumber}`}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(w.id)}
                          disabled={actingOn === w.id}
                          className="rounded-lg bg-green-50 p-2 text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => handleReject(w.id)}
                          disabled={actingOn === w.id}
                          className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
