import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PackageForm, type PackageFormValues } from "../components/PackageForm";

interface Project extends ProjectFormValues {
  id: string;
  fundingStatus: "open" | "target_reached" | "stopped";
  raisedAmountGhs: string;
}

const STATUS_LABEL: Record<Project["fundingStatus"], string> = {
  open: "Open for investment",
  target_reached: "Target reached",
  stopped: "Stopped",
};

const STATUS_COLOR: Record<Project["fundingStatus"], string> = {
  open: "bg-green-50 text-green-700",
  target_reached: "bg-blue-50 text-blue-700",
  stopped: "bg-red-50 text-red-700",
};

export function AdminPackageEditPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [package_, setPackage] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchPackage = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/projects/${packageId}`);
      const data = res.data.data;
      setPackage({
        ...data,
        maxInvestmentGhs: data.maxInvestmentGhs ?? "",
        imageUrl: data.imageUrl ?? "",
      });
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load package");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackage();
  }, [packageId]);

  async function handleSave(values: PackageFormValues) {
    try {
      setSubmitting(true);
      await api.patch(`/api/admin/projects/${packageId}`, {
        ...values,
        imageUrl: values.imageUrl || undefined,
        maxInvestmentGhs: values.maxInvestmentGhs || undefined,
      });
      toast.success("Package updated");
      fetchPackage();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.response?.data?.error?.formErrors?.[0] ?? "Failed to update package");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetStatus(status: Project["fundingStatus"]) {
    try {
      setStatusUpdating(true);
      await api.post(`/api/admin/projects/${packageId}/funding-status`, { status });
      toast.success(`Marked as "${STATUS_LABEL[status]}"`);
      fetchPackage();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to update package status");
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-96 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!package_) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-ink-600">Package not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/admin/packages")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Packages
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink-900">{package_.title}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[package_.fundingStatus]}`}
          >
            {STATUS_LABEL[package_.fundingStatus]}
          </span>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-ink-700 mb-3">
            Package status
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSetStatus("open")}
              disabled={statusUpdating || package_.fundingStatus === "open"}
              className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-40"
            >
              <PlayCircle size={16} />
              Activate
            </button>
            <button
              onClick={() => handleSetStatus("stopped")}
              disabled={statusUpdating || package_.fundingStatus === "stopped"}
              className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              <PauseCircle size={16} />
              Deactivate
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Investors can only invest in active packages.
          </p>
        </div>

        <PackageForm
          initialValues={package_}
          submitLabel="Save Changes"
          submitting={submitting}
          onSubmit={handleSave}
        />
      </div>
    </div>
  );
}
