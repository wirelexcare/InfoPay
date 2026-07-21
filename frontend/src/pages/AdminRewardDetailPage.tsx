import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface PoolDetail {
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
  percentClaimed: number;
  createdAt: string;
  claims: Array<{
    id: string;
    userEmail: string;
    userFullName: string;
    claimedAmountGhs: string;
    claimedAt: string;
  }>;
  claimCount: number;
  page: number;
  limit: number;
}

export function AdminRewardDetailPage() {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [claimsPage, setClaimsPage] = useState(1);

  const fetchPool = async (p = claimsPage) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/rewards/pools/${poolId}?page=${p}`);
      setPool(res.data.data);
      setEditExpiresAt(res.data.data.expiresAt || "");
      setClaimsPage(p);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load reward pool");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPool(1);
  }, [poolId]);

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await api.patch(`/api/admin/rewards/pools/${poolId}`, {
        status: newStatus,
      });
      toast.success(`Pool ${newStatus}`);
      fetchPool();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to update pool");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateExpiration = async () => {
    try {
      setUpdating(true);
      await api.patch(`/api/admin/rewards/pools/${poolId}`, {
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
      });
      toast.success("Expiration updated");
      fetchPool();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to update expiration");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-ink-600">Reward pool not found.</p>
        </div>
      </div>
    );
  }

  const statusBgColor: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    exhausted: "bg-amber-50 text-amber-700",
    expired: "bg-red-50 text-red-700",
    paused: "bg-gray-50 text-gray-700",
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin/rewards")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Pools
        </button>

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink-900">Reward Pool</h1>
              <p className="text-sm text-ink-500 font-mono">{pool.code}</p>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                statusBgColor[pool.status] || "bg-gray-50 text-gray-700"
              }`}
            >
              {pool.status}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Pool Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Total Pool
              </p>
              <p className="text-lg font-bold text-ink-900">
                ₵{parseFloat(pool.totalPoolGhs).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Claimed
              </p>
              <p className="text-lg font-bold text-ink-900">
                ₵{parseFloat(pool.claimedPoolGhs).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                % Exhausted
              </p>
              <p className="text-lg font-bold text-ink-900">
                {pool.percentClaimed.toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Claims
              </p>
              <p className="text-lg font-bold text-ink-900">{pool.claimCount}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-bold text-ink-700 mb-3">Pool Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-ink-500">Reward Type</span>
                <span className="text-sm font-medium text-ink-900 capitalize">
                  {pool.rewardType === "fixed"
                    ? `Fixed (₵${pool.fixedAmountGhs})`
                    : `Random (₵${pool.minAmountGhs} - ₵${pool.maxAmountGhs})`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-ink-500">
                  Allow Duplicate Claims
                </span>
                <span className="text-sm font-medium text-ink-900 capitalize">
                  {pool.allowDuplicateClaims ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-ink-500">Created</span>
                <span className="text-sm font-medium text-ink-900">
                  {new Date(pool.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Pool Controls
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-ink-700">
                Expiration Date/Time
              </label>
              <div className="flex gap-2 mt-2">
                <input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="flex-1 rounded-lg border border-border px-3 py-2"
                />
                <button
                  onClick={handleUpdateExpiration}
                  disabled={updating}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Update"}
                </button>
              </div>
              {pool.expiresAt && (
                <p className="text-xs text-ink-500 mt-1">
                  Currently expires: {new Date(pool.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {pool.status === "active" && (
              <button
                onClick={() => handleUpdateStatus("paused")}
                disabled={updating}
                className="flex-1 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                Pause Pool
              </button>
            )}
            {pool.status === "paused" && (
              <button
                onClick={() => handleUpdateStatus("active")}
                disabled={updating}
                className="flex-1 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                Resume Pool
              </button>
            )}
            {pool.status === "exhausted" && (
              <button
                onClick={() => handleUpdateStatus("paused")}
                disabled={updating}
                className="flex-1 rounded-lg bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Mark as Paused
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Claims ({pool.claimCount})
          </h2>
          {pool.claims.length === 0 ? (
            <p className="text-sm text-ink-600">No claims yet.</p>
          ) : (
            <div className="space-y-2">
              {pool.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex justify-between items-center py-3 border-b border-border/50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {claim.userFullName}
                    </p>
                    <p className="text-xs text-ink-500">{claim.userEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-900">
                      ₵{parseFloat(claim.claimedAmountGhs).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {new Date(claim.claimedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pool.claims.length > 0 && (
            <Pagination
              page={pool.page}
              limit={pool.limit}
              total={pool.claimCount}
              itemCount={pool.claims.length}
              onPageChange={fetchPool}
              itemLabel="claims"
            />
          )}
        </div>
      </div>
    </div>
  );
}
