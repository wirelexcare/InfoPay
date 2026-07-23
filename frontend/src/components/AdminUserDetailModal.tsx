import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Minus, Plus, ShieldPlus, ShieldMinus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface UserDetail {
  user: {
    id: string;
    phone: string;
    fullName: string;
    country: string;
    role: string;
    kycStatus: string;
    isSuspended: boolean;
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
  permissions: string[];
}

const SCOPE_LABELS: Record<string, string> = {
  "users.manage": "Manage users (suspend/activate)",
  "kyc.manage": "Manage KYC (approve/reject)",
  "projects.manage": "Manage projects (create/edit/funding status)",
  "withdrawals.manage": "Manage withdrawals (approve/reject)",
  "admins.manage": "Manage admin roles",
  "roi.manage": "Manage ROI adjustments & reconciliation",
  "referrals.manage": "Manage referral program settings",
  "deposits.manage": "Manage mobile money deposit review",
  "rewards.manage": "Manage reward pools & random bonuses",
  "announcements.manage": "Manage announcements",
  "support.manage": "Manage support links",
  "chats.manage": "Manage live chats",
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS);

export function AdminUserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [level, setLevel] = useState<"full" | "limited">("limited");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/users/${userId}`);
      setData(res.data);
      setSelectedScopes(res.data.permissions?.filter((p: string) => p !== "*") ?? []);
      setLevel(res.data.permissions?.includes("*") ? "full" : "limited");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const handleWalletAdjust = async (direction: "credit" | "debit") => {
    const amount = Number(adjAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (adjReason.trim().length < 3) {
      toast.error("Enter a reason (at least 3 characters)");
      return;
    }
    try {
      setAdjusting(true);
      const { data: res } = await api.post(
        `/api/admin/users/${userId}/wallet-adjustment`,
        { direction, amountGhs: adjAmount, reason: adjReason.trim() },
      );
      toast.success(
        `${direction === "credit" ? "Credited" : "Debited"} ₵${amount.toFixed(2)} · new balance ₵${Number(res.balanceAfter).toFixed(2)}`,
      );
      setAdjAmount("");
      setAdjReason("");
      fetchUser();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to adjust wallet");
    } finally {
      setAdjusting(false);
    }
  };

  const handleSaveRole = async () => {
    try {
      setActing(true);
      await api.post(`/api/admin/users/${userId}/promote`, {
        level,
        permissions: level === "limited" ? selectedScopes : undefined,
      });
      toast.success("Admin access updated");
      setShowRoleForm(false);
      fetchUser();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to update admin access");
    } finally {
      setActing(false);
    }
  };

  const handleRevokeAdmin = async () => {
    try {
      setActing(true);
      await api.post(`/api/admin/users/${userId}/demote`);
      toast.success("Admin access revoked");
      fetchUser();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to revoke admin access");
    } finally {
      setActing(false);
    }
  };

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  const detail = data;
  const isAdmin = detail?.user.role === "admin";
  const isFullAdmin = detail?.permissions.includes("*") ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-background shadow-soft-lg animate-in slide-in-from-bottom-4 duration-200 sm:m-4 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink-900">
              {loading ? "Loading..." : detail?.user.fullName ?? "User"}
            </p>
            {detail && <p className="truncate text-xs text-ink-500">{detail.user.phone}</p>}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-40 bg-ink-100 rounded-lg animate-pulse" />
              <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
            </div>
          ) : !detail ? (
            <p className="text-ink-600">User not found.</p>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 mb-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-ink-900">{detail.user.fullName}</h1>
                    <p className="text-ink-600">{detail.user.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    {detail.user.isSuspended ? (
                      <button
                        onClick={handleActivate}
                        disabled={acting}
                        className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Activate
                      </button>
                    ) : (
                      <button
                        onClick={handleSuspend}
                        disabled={acting}
                        className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Ban size={16} />
                        Suspend
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">Country</p>
                    <p className="text-sm font-semibold text-ink-900">{detail.user.country}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">KYC Status</p>
                    <p className="text-sm font-semibold text-ink-900 capitalize">
                      {detail.user.kycStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      Wallet Balance
                    </p>
                    <p className="text-sm font-semibold text-ink-900">
                      ₵{parseFloat(detail.wallet?.balanceGhs || "0").toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      Account Status
                    </p>
                    <p
                      className={`text-sm font-semibold ${detail.user.isSuspended ? "text-red-600" : "text-green-600"}`}
                    >
                      {detail.user.isSuspended ? "Suspended" : "Active"}
                    </p>
                  </div>
                </div>

                {detail.kyc && (
                  <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-ink-500 uppercase">Province</p>
                      <p className="text-sm font-semibold text-ink-900">
                        {detail.kyc.province}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-500 uppercase">WhatsApp</p>
                      <p className="text-sm font-semibold text-ink-900">
                        {detail.kyc.whatsappNumber}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 mb-6">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-primary" />
                  <h2 className="text-lg font-bold text-ink-900">Wallet adjustment</h2>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  Current balance:{" "}
                  <span className="font-semibold text-ink-900">
                    ₵{parseFloat(detail.wallet?.balanceGhs || "0").toFixed(2)}
                  </span>
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-ink-500">
                      Amount (GHS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-ink-500">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="e.g. bonus, correction, refund"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => handleWalletAdjust("credit")}
                    disabled={adjusting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Credit wallet
                  </button>
                  <button
                    onClick={() => handleWalletAdjust("debit")}
                    disabled={adjusting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <Minus size={16} />
                    Debit wallet
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  Every adjustment is recorded in the user's transaction history and the admin audit log.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink-900">Admin Access</h2>
                    {isAdmin ? (
                      <p className="text-sm text-ink-600 mt-1">
                        {isFullAdmin
                          ? "Full admin — access to everything"
                          : detail.permissions.length > 0
                            ? `Limited admin — ${detail.permissions.map((p) => SCOPE_LABELS[p] ?? p).join(", ")}`
                            : "Limited admin — no permissions granted"}
                      </p>
                    ) : (
                      <p className="text-sm text-ink-600 mt-1">Regular investor account</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRoleForm((v) => !v)}
                      disabled={acting}
                      className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <ShieldPlus size={16} />
                      {isAdmin ? "Edit Access" : "Make Admin"}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleRevokeAdmin}
                        disabled={acting}
                        className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <ShieldMinus size={16} />
                        Revoke Admin
                      </button>
                    )}
                  </div>
                </div>

                {showRoleForm && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={() => setLevel("full")}
                        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          level === "full"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-ink-600 hover:bg-ink-50"
                        }`}
                      >
                        Full Access
                      </button>
                      <button
                        onClick={() => setLevel("limited")}
                        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          level === "limited"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-ink-600 hover:bg-ink-50"
                        }`}
                      >
                        Limited Access
                      </button>
                    </div>

                    {level === "limited" && (
                      <div className="space-y-2 mb-4">
                        {ALL_SCOPES.map((scope) => (
                          <label
                            key={scope}
                            className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-ink-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedScopes.includes(scope)}
                              onChange={() => toggleScope(scope)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-ink-700">
                              {SCOPE_LABELS[scope]}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleSaveRole}
                      disabled={acting}
                      className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {acting ? "Saving..." : "Save Admin Access"}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6 mb-6">
                <h2 className="text-lg font-bold mb-4">
                  Investments ({detail.investments.length})
                </h2>
                {detail.investments.length === 0 ? (
                  <p className="text-sm text-ink-600">No investments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.investments.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                      >
                        <span className="text-sm text-ink-700 capitalize">{inv.status}</span>
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

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
                {detail.recentTxns.length === 0 ? (
                  <p className="text-sm text-ink-600">No transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.recentTxns.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
                      >
                        <span className="text-sm text-ink-700 capitalize">{txn.type}</span>
                        <span className="text-sm font-semibold text-ink-900">
                          ₵{parseFloat(txn.amountGhs).toFixed(2)}
                        </span>
                        <span className="text-xs text-ink-500 capitalize">{txn.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
