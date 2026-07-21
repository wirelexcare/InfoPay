import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

const STATUSES = ["", "waiting", "confirming", "confirmed", "failed", "expired"];

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchData = async (p: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: p.toString(),
        ...(status && { status }),
      });
      const res = await api.get(`/api/admin/payments/crypto?${params}`);
      setPayments(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [status]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <h1 className="text-3xl font-bold mb-6">Crypto Payments</h1>

        <div className="mb-6 flex gap-3 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:bg-ink-50"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-ink-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Confirmed
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/admin/payments/${p.id}`)}
                    className="cursor-pointer border-b border-border/50 hover:bg-ink-50/50"
                  >
                    <td className="px-6 py-4 text-sm font-mono text-ink-600">
                      {p.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-semibold text-ink-900">
                      ${parseFloat(p.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          p.status === "confirmed"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {p.confirmed ? "✓" : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-600">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && payments.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-ink-600">No payments found</p>
          </div>
        )}

        {!loading && (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            itemCount={payments.length}
            onPageChange={fetchData}
            itemLabel="payments"
          />
        )}
      </div>
    </div>
  );
}
