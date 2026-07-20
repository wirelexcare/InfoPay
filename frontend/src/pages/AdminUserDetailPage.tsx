import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface UserDetail {
  user: {
    id: string;
    email: string;
    fullName: string;
    country: string;
    role: string;
    kycStatus: string;
    createdAt: string;
  };
  kyc: {
    province: string;
    whatsappNumber: string;
    status: string;
  } | null;
  wallet: { balanceGhs: string } | null;
  investments: {
    id: string;
    amountGhs: string;
    status: string;
    createdAt: string;
  }[];
  recentTxns: {
    id: string;
    type: string;
    amountGhs: string;
    status: string;
    createdAt: string;
  }[];
}

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/users/${userId}`);
      setData(res.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const handleSuspend = async () => {
    try {
      setActing(true);
      await api.post(`/api/admin/users/${userId}/suspend`, {
        reason: "Suspended by admin",
      });
      toast.success("User suspended");
      fetchUser();
    } catch (error) {
      toast.error("Failed to suspend user");
    } finally {
      setActing(false);
    }
  };

  const handleActivate = async () => {
    try {
      setActing(true);
      await api.post(`/api/admin/users/${userId}/activate`);
      toast.success("User activated");
      fetchUser();
    } catch (error) {
      toast.error("Failed to activate user");
    } finally {
      setActing(false);
    }
  };

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

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-ink-600">User not found.</p>
        </div>
      </div>
    );
  }

  const { user, kyc, wallet, investments, recentTxns } = data;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin/users")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Users
        </button>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{user.fullName}</h1>
              <p className="text-ink-600">{user.email}</p>
            </div>
            <div className="flex gap-2">
              {user.role !== "admin" && (
                <button
                  onClick={handleSuspend}
                  disabled={acting}
                  className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <Ban size={16} />
                  Suspend
                </button>
              )}
              <button
                onClick={handleActivate}
                disabled={acting}
                className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                Activate
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Country
              </p>
              <p className="text-sm font-semibold text-ink-900">{user.country}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                KYC Status
              </p>
              <p className="text-sm font-semibold text-ink-900 capitalize">
                {user.kycStatus}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Wallet Balance
              </p>
              <p className="text-sm font-semibold text-ink-900">
                ₵{parseFloat(wallet?.balanceGhs || "0").toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase">
                Joined
              </p>
              <p className="text-sm font-semibold text-ink-900">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {kyc && (
            <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase">
                  Province
                </p>
                <p className="text-sm font-semibold text-ink-900">
                  {kyc.province}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-500 uppercase">
                  WhatsApp
                </p>
                <p className="text-sm font-semibold text-ink-900">
                  {kyc.whatsappNumber}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">
            Investments ({investments.length})
          </h2>
          {investments.length === 0 ? (
            <p className="text-sm text-ink-600">No investments yet.</p>
          ) : (
            <div className="space-y-2">
              {investments.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                >
                  <span className="text-sm text-ink-700 capitalize">
                    {inv.status}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    ₵{parseFloat(inv.amountGhs).toFixed(2)}
                  </span>
                  <span className="text-xs text-ink-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
          {recentTxns.length === 0 ? (
            <p className="text-sm text-ink-600">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {recentTxns.map((txn) => (
                <div
                  key={txn.id}
                  className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                >
                  <span className="text-sm text-ink-700 capitalize">
                    {txn.type}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    ₵{parseFloat(txn.amountGhs).toFixed(2)}
                  </span>
                  <span className="text-xs text-ink-500 capitalize">
                    {txn.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
