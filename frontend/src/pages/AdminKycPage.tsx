import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface KycRecord {
  id: string;
  userId: string;
  fullName: string;
  country: string;
  province: string;
  whatsappNumber: string;
  status: string;
  createdAt: string;
}

export function AdminKycPage() {
  const navigate = useNavigate();
  const [kycs, setKycs] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchPendingKyc(1);
  }, []);

  const fetchPendingKyc = async (p: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/kyc/pending?page=${p}`);
      setKycs(res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } catch (error) {
      console.error("Failed to fetch KYC:", error);
      toast.error("Failed to load KYC records");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (kycId: string) => {
    try {
      setActingOnId(kycId);
      await api.post(`/api/admin/kyc/${kycId}/approve`);
      toast.success("KYC approved");
      setKycs((prev) => prev.filter((k) => k.id !== kycId));
      setTotal((t) => t - 1);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error approving KYC");
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (kycId: string) => {
    try {
      setActingOnId(kycId);
      await api.post(`/api/admin/kyc/${kycId}/reject`, { reason: rejectReason });
      toast.success("KYC rejected");
      setKycs((prev) => prev.filter((k) => k.id !== kycId));
      setTotal((t) => t - 1);
      setShowRejectModal(null);
      setRejectReason("");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error rejecting KYC");
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-6">
          Pending KYC Reviews ({total})
        </h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : kycs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-lg font-medium text-ink-900 mb-2">All caught up!</p>
            <p className="text-ink-600">No pending KYC reviews.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {kycs.map((kyc) => (
              <div
                key={kyc.id}
                className="rounded-lg border border-border bg-card p-6"
              >
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      Full Name
                    </p>
                    <p className="text-base font-semibold text-ink-900">
                      {kyc.fullName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      Country
                    </p>
                    <p className="text-base font-semibold text-ink-900">
                      {kyc.country}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      Province
                    </p>
                    <p className="text-base font-semibold text-ink-900">
                      {kyc.province}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase">
                      WhatsApp
                    </p>
                    <p className="text-base font-semibold text-ink-900">
                      {kyc.whatsappNumber}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-ink-500 mb-4">
                  Submitted{" "}
                  {new Date(kyc.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(kyc.id)}
                    disabled={actingOnId === kyc.id}
                    className="flex items-center gap-2 flex-1 rounded-lg bg-green-50 px-4 py-2 font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                  >
                    <Check size={18} />
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectModal(kyc.id)}
                    disabled={actingOnId === kyc.id}
                    className="flex items-center gap-2 flex-1 rounded-lg bg-red-50 px-4 py-2 font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <X size={18} />
                    Reject
                  </button>
                </div>

                {showRejectModal === kyc.id && (
                  <div className="mt-4 p-4 rounded-lg bg-ink-50 border border-border">
                    <p className="text-sm font-medium text-ink-900 mb-2">
                      Rejection reason (optional)
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this KYC is being rejected..."
                      className="w-full p-2 rounded border border-border text-sm mb-3"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(kyc.id)}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setShowRejectModal(null)}
                        className="flex-1 rounded-lg border border-border bg-card px-4 py-2 font-medium transition hover:bg-ink-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && kycs.length > 0 && (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            itemCount={kycs.length}
            onPageChange={fetchPendingKyc}
            itemLabel="pending KYC reviews"
          />
        )}
      </div>
    </div>
  );
}
