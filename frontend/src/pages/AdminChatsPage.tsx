import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface Conversation {
  userId: string;
  userFullName: string;
  userPhone: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  lockedByAdminName: string | null;
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AdminChatsPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchChats(initial = false) {
      if (inFlightRef.current) return;
      if (!initial && document.visibilityState === "hidden") return;
      inFlightRef.current = true;
      try {
        const { data } = await api.get("/api/admin/chats");
        if (!cancelled) setConversations(data.data);
      } catch (error) {
        if (initial && !cancelled) toast.error("Failed to load chats");
      } finally {
        inFlightRef.current = false;
        if (initial && !cancelled) setLoading(false);
      }
    }

    fetchChats(true);
    const interval = setInterval(() => fetchChats(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-6">Live Chats</h1>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 bg-ink-100 rounded-lg animate-pulse" />
            <div className="h-20 bg-ink-100 rounded-lg animate-pulse" />
            <div className="h-20 bg-ink-100 rounded-lg animate-pulse" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <MessageSquare size={28} className="mx-auto text-ink-300" />
            <p className="mt-3 text-sm font-semibold text-ink-700">No conversations yet</p>
            <p className="mt-1 text-xs text-ink-400">
              Chats appear here when users message the team or submit a top-up.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border/60">
            {conversations.map((c) => (
              <button
                key={c.userId}
                onClick={() => navigate(`/admin/chats/${c.userId}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-ink-50/60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(c.userFullName || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold text-ink-900">
                      <span className="truncate">{c.userFullName}</span>
                      {c.lockedByAdminName && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                          title={`Claimed by ${c.lockedByAdminName}`}
                        >
                          <Lock size={9} />
                          {c.lockedByAdminName}
                        </span>
                      )}
                    </p>
                    <p className="shrink-0 text-xs text-ink-400">
                      {relativeTime(c.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-ink-500">
                      {c.lastMessagePreview || c.userPhone}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
