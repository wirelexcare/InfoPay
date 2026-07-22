import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PackageForm, type PackageFormValues } from "../components/PackageForm";

interface Package extends PackageFormValues {
  id: string;
  isActive: boolean;
}

export function AdminPackageEditPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [package_, setPackage] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchPackage = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/packages/${packageId}`);
      setPackage(res.data.data);
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
      await api.patch(`/api/admin/packages/${packageId}`, {
        title: values.title,
        minInvestmentGhs: values.minInvestmentGhs,
        expectedReturnPct: values.expectedReturnPct,
        durationDays: values.durationDays,
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

  async function handleToggleActive(isActive: boolean) {
    try {
      setStatusUpdating(true);
      await api.post(`/api/admin/packages/${packageId}/active`, { isActive });
      toast.success(isActive ? "Package activated" : "Package deactivated");
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
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              package_.isActive
                ? "bg-green-50 text-green-700"
                : "bg-ink-100 text-ink-500"
            }`}
          >
            {package_.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-ink-700 mb-3">
            Package status
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleToggleActive(true)}
              disabled={statusUpdating || package_.isActive}
              className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-40"
            >
              <PlayCircle size={16} />
              Activate
            </button>
            <button
              onClick={() => handleToggleActive(false)}
              disabled={statusUpdating || !package_.isActive}
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
