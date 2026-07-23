import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { AdminUserDetailModal } from "../components/AdminUserDetailModal";

interface WithdrawalDetail {
  id: string;
  userId: string;
  type: string;
  amountGhs: string;
  balanceBeforeGhs: string;
  balanceAfterGhs: string;
  status: string;
  method: string | null;
  reference: string | null;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    fullName: string;
    country: string;
    kycStatus: string;
  } | null;
  withdrawalMethod: {
    type: string;
    network: string | null;
    accountName: string;
    accountNumber: string | null;
    cryptoAddress: string | null;
  } | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-900 text-right break-all max-w-[60%]">
        {value ?? "—"}
      </span>
    </div>
  );
}

export function AdminWithdrawalDetailPage() {
  const { txnId } = useParams();
  const navigate = useNavigate();
  const [txn, setTxn] = useState<WithdrawalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const fetchTxn = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/withdrawals/${txnId}`);
      setTxn(res.data.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load withdrawal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTxn();
  }, [txnId]);

  async function handleApprove() {
    try {
      setActing(true);
      await api.post(`/api/admin/withdrawals/${txnId}/approve`);
      toast.success("Withdrawal approved");
      fetchTxn();
    } catch (error) {
      toast.error("Error approving withdrawal");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    try {
      setActing(true);
      await api.post(`/api/admin/withdrawals/${txnId}/reject`, {
        reason: "Rejected by admin",
      });
      toast.success("Withdrawal rejected and refunded");
      fetchTxn();
    } catch (error) {
      toast.error("Error rejecting withdrawal");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-ink-600">Withdrawal not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/admin/withdrawals")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Withdrawals
        </button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Withdrawal</h1>
            <p className="text-sm text-ink-500 font-mono">{txn.id}</p>
          </div>
          {txn.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                <Check size={16} />
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={acting}
                className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <X size={16} />
                Reject
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">Client</h2>
          {txn.user ? (
            <>
              <Row label="Name" value={txn.user.fullName} />
              <Row label="Phone" value={txn.user.phone} />
              <Row label="Country" value={txn.user.country} />
              <Row label="KYC Status" value={txn.user.kycStatus} />
              <button
                onClick={() => setViewUserId(txn.user!.id)}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                View full user profile →
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-500">Client not found.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">
            Payment Method
          </h2>
          {txn.withdrawalMethod ? (
            <>
              <Row label="Type" value={txn.withdrawalMethod.type} />
              {txn.withdrawalMethod.network && (
                <Row label="Network" value={txn.withdrawalMethod.network} />
              )}
              <Row label="Account Name" value={txn.withdrawalMethod.accountName} />
              {txn.withdrawalMethod.accountNumber && (
                <Row
                  label="Account Number"
                  value={txn.withdrawalMethod.accountNumber}
                />
              )}
              {txn.withdrawalMethod.cryptoAddress && (
                <Row
                  label="Crypto Address"
                  value={txn.withdrawalMethod.cryptoAddress}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-ink-500">No payment method on file.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">
            Transaction Details
          </h2>
          <Row label="Status" value={txn.status} />
          <Row label="Amount" value={`₵${parseFloat(txn.amountGhs).toFixed(2)}`} />
          <Row
            label="Balance Before"
            value={`₵${parseFloat(txn.balanceBeforeGhs).toFixed(2)}`}
          />
          <Row
            label="Balance After"
            value={`₵${parseFloat(txn.balanceAfterGhs).toFixed(2)}`}
          />
          <Row label="Method" value={txn.method} />
          <Row label="Reference" value={txn.reference} />
          <Row label="Description" value={txn.description} />
          <Row label="Requested" value={new Date(txn.createdAt).toLocaleString()} />
        </div>
      </div>

      {viewUserId && (
        <AdminUserDetailModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
        />
      )}
    </div>
  );
}
