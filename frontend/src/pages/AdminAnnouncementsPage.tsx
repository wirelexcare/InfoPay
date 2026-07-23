import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export function AdminAnnouncementsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/announcements");
      setItems(res.data.data);
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
  }

  async function handleSubmit() {
    if (title.trim().length < 2 || body.trim().length < 2) {
      toast.error("Enter a title and message");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await api.patch(`/api/admin/announcements/${editingId}`, { title, body });
        toast.success("Announcement updated");
      } else {
        await api.post("/api/admin/announcements", { title, body });
        toast.success("Announcement created");
      }
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(a: Announcement) {
    try {
      await api.patch(`/api/admin/announcements/${a.id}`, { isActive: !a.isActive });
      setItems((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, isActive: !x.isActive } : x)),
      );
    } catch {
      toast.error("Failed to update");
    }
  }

  async function remove(a: Announcement) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await api.delete(`/api/admin/announcements/${a.id}`);
      toast.success("Deleted");
      fetchItems();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setItems(reordered);
    try {
      await api.post("/api/admin/announcements/reorder", {
        ids: reordered.map((x) => x.id),
      });
    } catch {
      toast.error("Failed to reorder");
      fetchItems();
    }
  }

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Announcements</h1>
          <p className="mt-1 text-sm text-ink-500">
            Active announcements show as a dismissable overlay when users open
            the app, in the order below. {activeCount} active.
          </p>
        </div>

        {/* Create / edit form */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">
              {editingId ? "Edit announcement" : "New announcement"}
            </h2>
            {editingId && (
              <button
                onClick={resetForm}
                className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"
              >
                <X size={14} /> Cancel edit
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase text-ink-500">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled maintenance"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-ink-500">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Write the announcement message..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              <Plus size={16} />
              {saving ? "Saving…" : editingId ? "Save changes" : "Create announcement"}
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-ink-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-400">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((a, index) => (
              <div
                key={a.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <span className="text-xs font-bold text-ink-400">{index + 1}</span>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-ink-900">{a.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          a.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {a.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">
                      {a.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          a.isActive
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {a.isActive ? "Turn off" : "Turn on"}
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="flex items-center gap-1 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
