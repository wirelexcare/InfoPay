import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface RoiRow {
  id: string;
  userId: string;
  amountGhs: string;
  projectTitle: string;
  userFullName: string;
  userEmail: string;
  createdAt: string;
  dailyAmount: number;
  expectedPaid: number;
  paidSoFar: number;
  discrepancy: number;
}

export function AdminRoiPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchData = async (p: number, q: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: p.toString(), ...(q && { search: q }) });
      const res = await api.get(`/api/admin/roi/investments?${params}`);
      setRows(res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load ROI reconciliation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, search);
  }, [search]);

  const flaggedCount = rows.filter((r) => Math.abs(r.discrepancy) > r.dailyAmount).length;

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

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">ROI Reconciliation</h1>
            <p className="text-sm text-ink-600 mt-1">
              {total} active investment{total === 1 ? "" : "s"}
              {flaggedCount > 0 && (
                <span className="ml-2 text-amber-700 font-medium">
                  · {flaggedCount} flagged
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-3 text-ink-400" />
          <input
            type="text"
            placeholder="Search by user, email, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-ink-600">No active investments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-ink-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Project</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Invested</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Expected</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Paid</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">
                    Discrepancy
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const flagged = Math.abs(r.discrepancy) > r.dailyAmount;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/admin/roi/${r.id}`)}
                      className="cursor-pointer border-b border-border/50 hover:bg-ink-50/50"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-ink-900">
                          {r.userFullName}
                        </div>
                        <div className="text-xs text-ink-500">{r.userEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        {r.projectTitle}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        ₵{parseFloat(r.amountGhs).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        ₵{r.expectedPaid.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-700">
                        ₵{r.paidSoFar.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {flagged ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle size={12} />
                            ₵{r.discrepancy.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-400">
                            ₵{r.discrepancy.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            itemCount={rows.length}
            onPageChange={(p) => fetchData(p, search)}
            itemLabel="active investments"
          />
        )}
      </div>
    </div>
  );
}
