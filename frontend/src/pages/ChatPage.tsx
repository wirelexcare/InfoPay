import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Paperclip, Send, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { useAuthStore } from "../lib/store";
import { subscribeToChatThread } from "../lib/realtime";

export interface ChatMessage {
  id: string;
  userId: string;
  senderId: string | null;
  senderRole: "user" | "admin" | "system";
  senderName: string | null;
  body: string | null;
  imageUrl: string | null;
  manualDepositId: string | null;
  createdAt: string;
  editedAt: string | null;
  editedByAdminName: string | null;
}

// Animated "..." dots shown while an admin is composing a reply.
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

// Full-screen preview for chat image attachments, in place of opening the
// image in a new tab.
export function ImageLightbox({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close preview"
      >
        <X size={18} />
      </button>
      <img
        src={url}
        alt="Attachment preview"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}

export interface ChatDeposit {
  id: string;
  reference: string;
  amountGhs: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  screenshotUrl?: string;
}

export function formatChatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

const DEPOSIT_STATUS_STYLES: Record<ChatDeposit["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const DEPOSIT_STATUS_LABELS: Record<ChatDeposit["status"], string> = {
  pending: "Pending review",
  approved: "Approved, wallet credited",
  rejected: "Rejected",
};

export function TopUpCard({
  deposit,
  align,
}: {
  deposit: ChatDeposit | undefined;
  align: "left" | "right";
}) {
  return (
    <div
      className={`w-56 rounded-2xl border border-border bg-card p-3.5 shadow-soft ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Wallet size={15} />
        </span>
        <p className="text-xs font-bold text-ink-900">Top-up request</p>
      </div>
      {deposit ? (
        <>
          <p className="mt-2 text-lg font-extrabold tracking-tight text-ink-900">
            GHS {Number(deposit.amountGhs).toFixed(2)}
          </p>
          <p className="text-[11px] text-ink-400">Ref: {deposit.reference}</p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${DEPOSIT_STATUS_STYLES[deposit.status]}`}
          >
            {DEPOSIT_STATUS_LABELS[deposit.status]}
          </span>
          {deposit.status === "rejected" && deposit.rejectionReason && (
            <p className="mt-1.5 text-[11px] text-red-600">{deposit.rejectionReason}</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-ink-400">Top-up details unavailable</p>
      )}
    </div>
  );
}

export function ChatPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [deposits, setDeposits] = useState<Record<string, ChatDeposit>>({});
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [typingAdminName, setTypingAdminName] = useState<string | null>(null);

  // Tracks which message ids we've already rendered, purely to detect newly
  // arrived messages (for scroll/mark-read) -- the message list itself is
  // always replaced wholesale from the server response (see absorb below),
  // since a hard-deleted message leaves no tombstone to diff against.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function absorb(incoming: ChatMessage[], depositList: ChatDeposit[]) {
    setDeposits(Object.fromEntries(depositList.map((d) => [d.id, d])));
    const newOnes = incoming.filter((m) => !seenIdsRef.current.has(m.id));
    seenIdsRef.current = new Set(incoming.map((m) => m.id));
    setMessages(incoming);
    return newOnes;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function poll(initial = false) {
      if (inFlightRef.current) return;
      if (!initial && document.visibilityState === "hidden") return;
      inFlightRef.current = true;
      try {
        const { data } = await api.get("/api/chat/messages");
        if (cancelled) return;
        const newOnes = absorb(data.messages, data.deposits);
        if (newOnes.length > 0) {
          // Something arrived from the other side: mark thread read
          const unseenFromOthers = newOnes.some((m) => m.senderRole !== "user");
          if (unseenFromOthers) {
            api.post("/api/chat/read").catch(() => {});
          }
          scrollToBottom();
        }
      } catch (err) {
        if (initial && !cancelled) toast.error("Failed to load chat");
      } finally {
        inFlightRef.current = false;
        if (initial && !cancelled) setLoading(false);
      }
    }

    poll(true).then(() => {
      api.post("/api/chat/read").catch(() => {});
    });
    // Realtime broadcasts are the primary signal; polling is just the
    // fallback in case a signal is missed (tab backgrounded, brief drop).
    const interval = setInterval(() => poll(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    let typingTimeout: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = userId
      ? subscribeToChatThread(userId, (event) => {
          if (event.type === "messages-changed") {
            poll();
          } else if (event.type === "typing") {
            if (typingTimeout) clearTimeout(typingTimeout);
            if (event.isTyping) {
              setTypingAdminName(event.adminName);
              typingTimeout = setTimeout(() => setTypingAdminName(null), 8000);
            } else {
              setTypingAdminName(null);
            }
          }
        })
      : () => {};

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typingTimeout) clearTimeout(typingTimeout);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [userId]);

  async function handleAttach(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    try {
      setUploading(true);
      const res = await api.post("/api/chat/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachedImageUrl(res.data.url);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body && !attachedImageUrl) return;
    setSending(true);
    try {
      const { data } = await api.post("/api/chat/messages", {
        ...(body ? { body } : {}),
        ...(attachedImageUrl ? { imageUrl: attachedImageUrl } : {}),
      });
      const msg: ChatMessage = data.message;
      seenIdsRef.current.add(msg.id);
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      setInput("");
      setAttachedImageUrl(null);
      scrollToBottom();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="py-2 animate-in fade-in-0 duration-300">
      <div className="mb-3">
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Live Chat</h1>
        <p className="text-xs text-ink-400">
          Talk to our team about top-ups or anything else.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 rounded-2xl" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm font-semibold text-ink-700">No messages yet</p>
          <p className="mt-1 text-xs text-ink-400">
            Say hello, or submit a top-up from your wallet and track it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          {messages.map((m) => {
            if (m.senderRole === "system") {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="max-w-[85%] rounded-full bg-ink-100 px-4 py-1.5 text-center text-[11px] font-medium text-ink-600">
                    {m.body}
                  </div>
                </div>
              );
            }
            const mine = m.senderRole === "user";
            if (m.manualDepositId) {
              return (
                <div key={m.id}>
                  <TopUpCard
                    deposit={deposits[m.manualDepositId]}
                    align={mine ? "right" : "left"}
                  />
                  <p
                    className={`mt-1 text-[10px] text-ink-300 ${mine ? "text-right" : ""}`}
                  >
                    {formatChatTime(m.createdAt)}
                  </p>
                </div>
              );
            }
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[80%]">
                  {!mine && m.senderName && (
                    <p className="mb-0.5 text-[10px] font-semibold text-ink-400">
                      {m.senderName}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 shadow-soft ${
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-card text-ink-900"
                    }`}
                  >
                    {m.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(m.imageUrl)}
                        className="block"
                      >
                        <img
                          src={m.imageUrl}
                          alt="Attachment"
                          className="mb-1.5 max-h-56 w-full rounded-xl object-cover"
                        />
                      </button>
                    )}
                    {m.body && (
                      <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-[10px] text-ink-300 ${mine ? "text-right" : ""}`}
                  >
                    {formatChatTime(m.createdAt)}
                    {m.editedAt && " · edited"}
                  </p>
                </div>
              </div>
            );
          })}
          {typingAdminName && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-ink-400 shadow-soft">
                <TypingDots />
                <span className="text-xs">{typingAdminName} is typing</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer, fixed above the bottom nav */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-20 px-4">
        <div className="mx-auto w-full max-w-sm">
          {attachedImageUrl && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-soft">
              <img
                src={attachedImageUrl}
                alt="Attached"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <p className="flex-1 truncate text-xs text-ink-500">Image attached</p>
              <button
                type="button"
                onClick={() => setAttachedImageUrl(null)}
                className="grid h-7 w-7 place-items-center rounded-full text-ink-400 hover:bg-ink-100"
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-soft-lg backdrop-blur-md"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAttach(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-100 hover:text-ink-600 disabled:opacity-50"
              aria-label="Attach image"
            >
              {uploading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Paperclip size={17} />
              )}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-ink-900 outline-none placeholder:text-ink-300"
            />
            <button
              type="submit"
              disabled={sending || uploading || (!input.trim() && !attachedImageUrl)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      </div>

      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
