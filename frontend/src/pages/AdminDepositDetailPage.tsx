import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { AdminUserDetailModal } from "../components/AdminUserDetailModal";

interface DepositDetail {
  id: string;
  reference: string;
  amountGhs: string;
  network: string;
  senderName: string;
  senderNumber: string;
  screenshotUrl: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    fullName: string;
    country: string;
    kycStatus: string;
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

export function AdminDepositDetailPage() {
  const { depositId } = useParams();
  const navigate = useNavigate();
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<DepositDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchDeposit = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/manual-deposits/${depositId}`);
      setDeposit(res.data.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load deposit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposit();
  }, [depositId]);

  async function handleApprove() {
    try {
      setActing(true);
      await api.post(`/api/admin/manual-deposits/${depositId}/approve`);
      toast.success("Deposit approved and wallet credited");
      fetchDeposit();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Error approving deposit");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    const reason = window.prompt("Reason for rejecting this deposit:");
    if (!reason) return;
    try {
      setActing(true);
      await api.post(`/api/admin/manual-deposits/${depositId}/reject`, { reason });
      toast.success("Deposit rejected");
      fetchDeposit();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Error rejecting deposit");
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

  if (!deposit) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-ink-600">Deposit not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/admin/deposits")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Deposits
        </button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Mobile Money Deposit</h1>
            <p className="text-sm text-ink-500 font-mono">{deposit.reference}</p>
          </div>
          {deposit.status === "pending" && (
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
          {deposit.status !== "pending" && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                deposit.status === "approved"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {deposit.status}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">Client</h2>
          {deposit.user ? (
            <>
              <Row label="Name" value={deposit.user.fullName} />
              <Row label="Phone" value={deposit.user.phone} />
              <Row label="Country" value={deposit.user.country} />
              <Row label="KYC Status" value={deposit.user.kycStatus} />
              <button
                onClick={() => setViewUserId(deposit.user!.id)}
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
            Payment Details
          </h2>
          <Row label="Amount" value={`₵${parseFloat(deposit.amountGhs).toFixed(2)}`} />
          <Row label="Reference" value={deposit.reference} />
          <Row label="Network paid from" value={deposit.network.toUpperCase()} />
          <Row label="Sender name" value={deposit.senderName} />
          <Row label="Sender number" value={deposit.senderNumber} />
          <Row label="Submitted" value={new Date(deposit.createdAt).toLocaleString()} />
          {deposit.status === "rejected" && deposit.rejectionReason && (
            <Row label="Rejection reason" value={deposit.rejectionReason} />
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-3">
            Payment Screenshot
          </h2>
          <a href={deposit.screenshotUrl} target="_blank" rel="noreferrer">
            <img
              src={deposit.screenshotUrl}
              alt="Payment screenshot"
              className="w-full rounded-lg border border-border"
            />
          </a>
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
