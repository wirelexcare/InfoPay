import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface PaymentDetail {
  id: string;
  userId: string;
  network: string;
  asset: string;
  amount: string;
  txHash: string | null;
  confirmed: boolean;
  createdAt: string;
  providerPaymentId: string | null;
  amountGhs: string | null;
  payAmount: string | null;
  payCurrency: string | null;
  payAddress: string | null;
  status: string;
  user: {
    id: string;
    phone: string;
    fullName: string;
    country: string;
    kycStatus: string;
  } | null;
  project: { id: string; title: string } | null;
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

export function AdminPaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/admin/payments/crypto/${paymentId}`);
        setPayment(res.data.data);
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to load payment");
      } finally {
        setLoading(false);
      }
    };
    fetchPayment();
  }, [paymentId]);

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

  if (!payment) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-ink-600">Payment not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate("/admin/payments")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Payments
        </button>

        <h1 className="text-2xl font-bold text-ink-900 mb-1">Crypto Payment</h1>
        <p className="text-sm text-ink-500 mb-6 font-mono">{payment.id}</p>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">Client</h2>
          {payment.user ? (
            <>
              <Row label="Name" value={payment.user.fullName} />
              <Row label="Phone" value={payment.user.phone} />
              <Row label="Country" value={payment.user.country} />
              <Row label="KYC Status" value={payment.user.kycStatus} />
              <button
                onClick={() => navigate(`/admin/users/${payment.user!.id}`)}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                View full user profile →
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-500">Client not found.</p>
          )}
        </div>

        {payment.project && (
          <div className="rounded-lg border border-border bg-card p-6 mb-6">
            <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">
              Related Investment
            </h2>
            <Row label="Project" value={payment.project.title} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-2">
            Payment Details
          </h2>
          <Row label="Status" value={payment.status} />
          <Row label="Confirmed" value={payment.confirmed ? "Yes" : "No"} />
          <Row label="Amount (GHS)" value={payment.amountGhs ? `₵${parseFloat(payment.amountGhs).toFixed(2)}` : null} />
          <Row label="Amount (USD)" value={`$${parseFloat(payment.amount).toFixed(2)}`} />
          <Row label="Network" value={payment.network} />
          <Row label="Asset" value={payment.asset} />
          <Row label="Pay Amount" value={payment.payAmount} />
          <Row label="Pay Currency" value={payment.payCurrency} />
          <Row label="Pay Address" value={payment.payAddress} />
          <Row label="Transaction Hash" value={payment.txHash} />
          <Row label="Provider Payment ID" value={payment.providerPaymentId} />
          <Row
            label="Created"
            value={new Date(payment.createdAt).toLocaleString()}
          />
        </div>
      </div>
    </div>
  );
}
