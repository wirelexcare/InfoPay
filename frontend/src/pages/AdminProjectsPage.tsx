import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Project {
  id: string;
  title: string;
  location: string;
  raisedAmountGhs: string;
  targetAmountGhs: string;
  isActive: boolean;
}

const emptyForm = {
  title: "",
  description: "",
  location: "",
  targetAmountGhs: "",
  minInvestmentGhs: "",
  expectedReturnPct: "",
  durationMonths: "",
  imageUrl: "",
};

export function AdminProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/projects");
      setProjects(res.data.data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post("/api/admin/projects", {
        ...form,
        imageUrl: form.imageUrl || undefined,
      });
      toast.success("Project created");
      setShowForm(false);
      setForm(emptyForm);
      fetchProjects();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="text-3xl font-bold">Projects</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:shadow-soft"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? "Cancel" : "New Project"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-ink-700">Title</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-ink-700">
                Description
              </label>
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Location
              </label>
              <input
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Image URL (optional)
              </label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Target Amount (GHS)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={form.targetAmountGhs}
                onChange={(e) =>
                  setForm({ ...form, targetAmountGhs: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Min Investment (GHS)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={form.minInvestmentGhs}
                onChange={(e) =>
                  setForm({ ...form, minInvestmentGhs: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Expected Return (%)
              </label>
              <input
                required
                type="number"
                step="0.01"
                value={form.expectedReturnPct}
                onChange={(e) =>
                  setForm({ ...form, expectedReturnPct: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-700">
                Duration (months)
              </label>
              <input
                required
                type="number"
                value={form.durationMonths}
                onChange={(e) =>
                  setForm({ ...form, durationMonths: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-border px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-ink-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-ink-600">No projects yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-bold text-ink-900">{p.title}</h3>
                <p className="text-sm text-ink-600 mt-1">{p.location}</p>
                <div className="mt-3 flex justify-between text-sm">
                  <span>
                    Raised: ₵{parseFloat(p.raisedAmountGhs || "0").toFixed(0)} / ₵
                    {parseFloat(p.targetAmountGhs || "0").toFixed(0)}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
