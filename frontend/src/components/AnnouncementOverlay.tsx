import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { api } from "../lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
}

// Remembers which exact set of active announcements the user already
// dismissed, so it won't nag on every navigation — but reappears when the
// admin changes what's active.
const STORAGE_KEY = "infopay-announcements-dismissed";

function signatureOf(list: Announcement[]): string {
  return list.map((a) => a.id).join(",");
}

export function AnnouncementOverlay() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/announcements")
      .then(({ data }) => {
        if (cancelled) return;
        const list: Announcement[] = data.announcements ?? [];
        if (list.length === 0) return;
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed === signatureOf(list)) return; // already seen this set
        setItems(list);
        setIndex(0);
        setOpen(true);
      })
      .catch(() => {
        /* announcements are non-critical; ignore fetch errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    if (items.length > 0) {
      localStorage.setItem(STORAGE_KEY, signatureOf(items));
    }
    setOpen(false);
  }

  if (!open || items.length === 0) return null;

  const current = items[index];
  const isLast = index === items.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
          <div className="flex items-center gap-2 text-primary">
            <Megaphone size={18} />
            <span className="text-sm font-bold">Announcement</span>
            {items.length > 1 && (
              <span className="text-xs font-medium text-ink-400">
                {index + 1}/{items.length}
              </span>
            )}
          </div>
          <button
            onClick={dismiss}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close all"
          >
            <X size={14} />
            {items.length > 1 ? "Close all" : "Close"}
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[55dvh] overflow-y-auto px-5 py-5">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">
            {current.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
            {current.body}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border/70 px-5 py-4">
          {items.length > 1 && (
            <div className="flex flex-1 gap-1">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= index ? "bg-primary" : "bg-ink-200"
                  }`}
                />
              ))}
            </div>
          )}
          {isLast ? (
            <button
              onClick={dismiss}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
            >
              Finished
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
