import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { PackageForm, type PackageFormValues } from "../components/PackageForm";
import { Pagination } from "../components/ui/pagination";

interface Project {
  id: string;
  title: string;
  location: string;
  raisedAmountGhs: string;
  targetAmountGhs: string;
  fundingStatus: "open" | "target_reached" | "stopped";
}

const STATUS_LABEL: Record<Project["fundingStatus"], string> = {
  open: "Open",
  target_reached: "Target reached",
  stopped: "Stopped",
};

const STATUS_COLOR: Record<Project["fundingStatus"], string> = {
  open: "bg-green-50 text-green-700",
  target_reached: "bg-blue-50 text-blue-700",
  stopped: "bg-red-50 text-red-700",
};

export function AdminPackagesPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"true" | "false">("true");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchPackages = async (p = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: p.toString(),
        active: activeFilter,
        ...(search && { search }),
      });
      const res = await api.get(`/api/admin/projects?${params}`);
      setPackages(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages(1);
  }, [search, activeFilter]);

  async function handleCreate(values: PackageFormValues) {
    try {
      setSubmitting(true);
      await api.post("/api/admin/projects", {
        ...values,
        imageUrl: values.imageUrl || undefined,
        maxInvestmentGhs: values.maxInvestmentGhs || undefined,
      });
      toast.success("Package created");
      setShowForm(false);
      fetchPackages(1);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.response?.data?.error?.formErrors?.[0] ?? "Failed to create package");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Investment Packages</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:shadow-soft"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? "Cancel" : "New Package"}
          </button>
        </div>

        {showForm && (
          <div className="mb-6">
            <PackageForm
              submitLabel="Create Package"
              submitting={submitting}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-ink-400" />
            <input
              type="text"
              placeholder="Search by title or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter("true")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeFilter === "true"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:bg-ink-50"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveFilter("false")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeFilter === "false"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:bg-ink-50"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-ink-600">No packages yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {packages.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/packages/${p.id}`)}
                className="text-left rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-soft"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-ink-900">{p.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[p.fundingStatus]}`}
                  >
                    {STATUS_LABEL[p.fundingStatus]}
                  </span>
                </div>
                <p className="text-sm text-ink-600 mt-1">{p.location}</p>
                <div className="mt-3 flex justify-between text-sm">
                  <span>
                    Raised: ₵
                    {parseFloat(p.raisedAmountGhs || "0").toLocaleString()} / ₵
                    {parseFloat(p.targetAmountGhs || "0").toLocaleString()}
                  </span>
                  <span>
                    {Math.round(
                      ((parseFloat(p.raisedAmountGhs || "0") /
                        parseFloat(p.targetAmountGhs || "1")) *
                        100) || 0,
                    )}
                    %
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && packages.length > 0 && (
          <Pagination
            page={page}
            limit={limit}
            total={total}
            itemCount={packages.length}
            onPageChange={fetchPackages}
            itemLabel="packages"
          />
        )}
      </div>
    </div>
  );
}
