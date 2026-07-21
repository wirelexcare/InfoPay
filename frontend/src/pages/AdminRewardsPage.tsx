import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface RewardPool {
  id: string;
  code: string;
  totalPoolGhs: string;
  claimedPoolGhs: string;
  rewardType: "fixed" | "random_range";
  fixedAmountGhs?: string;
  minAmountGhs?: string;
  maxAmountGhs?: string;
  status: "active" | "exhausted" | "expired" | "paused";
  allowDuplicateClaims: boolean;
  expiresAt?: string;
  createdAt: string;
  percentClaimed: number;
}

const NETWORKS = ["mtn", "vodafone", "telecel", "airteltigo"];

export function AdminRewardsPage() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<RewardPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPool, setCreatingPool] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [formData, setFormData] = useState({
    totalPoolGhs: "",
    rewardType: "fixed" as "fixed" | "random_range",
    fixedAmountGhs: "",
    minAmountGhs: "",
    maxAmountGhs: "",
    allowDuplicateClaims: false,
    expiresAt: "",
  });

  const fetchPools = async (p = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: p.toString() });
      if (statusFilter) params.append("status", statusFilter);
      const res = await api.get(`/api/admin/rewards/pools?${params}`);
      setPools(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load reward pools");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools(1);
  }, [statusFilter]);

  const handleCreatePool = async () => {
    if (!formData.totalPoolGhs) {
      toast.error("Please enter a pool amount");
      return;
    }
    if (formData.rewardType === "fixed" && !formData.fixedAmountGhs) {
      toast.error("Please enter the fixed reward amount");
      return;
    }
    if (
      formData.rewardType === "random_range" &&
      (!formData.minAmountGhs || !formData.maxAmountGhs)
    ) {
      toast.error("Please enter min and max reward amounts");
      return;
    }

    try {
      setCreatingPool(true);
      const payload: any = {
        totalPoolGhs: Number(formData.totalPoolGhs),
        rewardType: formData.rewardType,
        allowDuplicateClaims: formData.allowDuplicateClaims,
      };
      if (formData.rewardType === "fixed") {
        payload.fixedAmountGhs = Number(formData.fixedAmountGhs);
      } else {
        payload.minAmountGhs = Number(formData.minAmountGhs);
        payload.maxAmountGhs = Number(formData.maxAmountGhs);
      }
      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      }

      await api.post("/api/admin/rewards/pools", payload);
      toast.success("Reward pool created");
      setFormData({
        totalPoolGhs: "",
        rewardType: "fixed",
        fixedAmountGhs: "",
        minAmountGhs: "",
        maxAmountGhs: "",
        allowDuplicateClaims: false,
        expiresAt: "",
      });
      setShowCreateForm(false);
      fetchPools();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to create pool");
    } finally {
      setCreatingPool(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const statusBgColor: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    exhausted: "bg-amber-50 text-amber-700",
    expired: "bg-red-50 text-red-700",
    paused: "bg-gray-50 text-gray-700",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold">Reward Pools & Random Bonuses</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {showCreateForm ? "Cancel" : "Create Pool"}
          </button>
        </div>

        {showCreateForm && (
          <div className="rounded-lg border border-border bg-card p-6 mb-6">
            <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
              New Reward Pool
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-ink-700">
                  Total Pool Amount (GHS)
                </label>
                <input
                  type="number"
                  value={formData.totalPoolGhs}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, totalPoolGhs: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink-700">
                  Reward Type
                </label>
                <select
                  value={formData.rewardType}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      rewardType: e.target.value as "fixed" | "random_range",
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                >
                  <option value="fixed">Fixed (same amount per claim)</option>
                  <option value="random_range">
                    Random Range (vary between min/max)
                  </option>
                </select>
              </div>

              {formData.rewardType === "fixed" ? (
                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Fixed Reward Amount (GHS)
                  </label>
                  <input
                    type="number"
                    value={formData.fixedAmountGhs}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        fixedAmountGhs: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                    placeholder="50"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Min Reward (GHS)
                    </label>
                    <input
                      type="number"
                      value={formData.minAmountGhs}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          minAmountGhs: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Max Reward (GHS)
                    </label>
                    <input
                      type="number"
                      value={formData.maxAmountGhs}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          maxAmountGhs: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                      placeholder="100"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-ink-700">
                  Expiration (optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, expiresAt: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={formData.allowDuplicateClaims}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        allowDuplicateClaims: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Allow duplicate claims per user
                </label>
              </div>
            </div>

            <button
              onClick={handleCreatePool}
              disabled={creatingPool}
              className="mt-4 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creatingPool ? "Creating..." : "Create Reward Pool"}
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-700 uppercase">
              Active Pools ({total})
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="exhausted">Exhausted</option>
              <option value="expired">Expired</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {pools.length === 0 ? (
            <p className="text-sm text-ink-600">No reward pools yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-ink-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Claimed
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      % Done
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((pool) => (
                    <tr
                      key={pool.id}
                      className="border-b border-border/50 hover:bg-ink-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold">
                            {pool.code}
                          </span>
                          <button
                            onClick={() => copyCode(pool.code)}
                            className="text-ink-500 hover:text-primary"
                          >
                            {copiedCode === pool.code ? (
                              <Check size={16} />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        ₵{parseFloat(pool.totalPoolGhs).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        ₵{parseFloat(pool.claimedPoolGhs).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {pool.percentClaimed.toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-xs uppercase">
                        {pool.rewardType === "fixed" ? (
                          `Fixed (₵${pool.fixedAmountGhs})`
                        ) : (
                          `Random (₵${pool.minAmountGhs}-₵${pool.maxAmountGhs})`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                            statusBgColor[pool.status] ||
                            "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {pool.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-600">
                        {pool.expiresAt
                          ? new Date(pool.expiresAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/admin/rewards/${pool.id}`)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pools.length > 0 && (
            <Pagination
              page={page}
              limit={limit}
              total={total}
              itemCount={pools.length}
              onPageChange={fetchPools}
              itemLabel="reward pools"
            />
          )}
        </div>
      </div>
    </div>
  );
}
