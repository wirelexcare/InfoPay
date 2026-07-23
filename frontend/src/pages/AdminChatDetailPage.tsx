import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Loader2,
  Paperclip,
  Send,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import {
  formatChatTime,
  type ChatDeposit,
  type ChatMessage,
} from "./ChatPage";

interface ChatUser {
  id: string;
  fullName: string;
  phone: string;
}

interface MomoSettings {
  network: string;
  accountName: string;
  accountNumber: string;
}

const DEPOSIT_STATUS_STYLES: Record<ChatDeposit["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function AdminChatDetailPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [deposits, setDeposits] = useState<Record<string, ChatDeposit>>({});
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Deposit review state
  const [actingDepositId, setActingDepositId] = useState<string | null>(null);
  const [rejectingDeposit, setRejectingDeposit] = useState<ChatDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Receiving MoMo account, used by the payment-instructions template
  const [momoSettings, setMomoSettings] = useState<MomoSettings | null>(null);
  useEffect(() => {
    api
      .get("/api/admin/deposit-settings")
      .then(({ data }) => setMomoSettings(data.data ?? null))
      .catch(() => {});
  }, []);

  // Credit wallet dialog state
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);

  const lastTsRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  function absorb(incoming: ChatMessage[], depositList: ChatDeposit[]) {
    setDeposits(Object.fromEntries(depositList.map((d) => [d.id, d])));
    const fresh = incoming.filter((m) => !seenIdsRef.current.has(m.id));
    if (fresh.length === 0) return false;
    for (const m of fresh) seenIdsRef.current.add(m.id);
    const newest = fresh[fresh.length - 1];
    if (!lastTsRef.current || newest.createdAt > lastTsRef.current) {
      lastTsRef.current = newest.createdAt;
    }
    setMessages((prev) => [...prev, ...fresh]);
    return true;
  }

  async function refetchAll() {
    // Full refetch after deposit actions so status flips + system messages arrive
    try {
      const { data } = await api.get(`/api/admin/chats/${userId}/messages`);
      const hadNew = absorb(data.messages, data.deposits);
      if (hadNew) scrollToBottom();
    } catch {
      // next poll will catch up
    }
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function poll(initial = false) {
      if (inFlightRef.current) return;
      if (!initial && document.visibilityState === "hidden") return;
      inFlightRef.current = true;
      try {
        const params = lastTsRef.current ? { after: lastTsRef.current } : undefined;
        const { data } = await api.get(`/api/admin/chats/${userId}/messages`, { params });
        if (cancelled) return;
        if (data.user) setChatUser(data.user);
        const hadNew = absorb(data.messages, data.deposits);
        if (hadNew) {
          const newUserMessages = (data.messages as ChatMessage[]).some(
            (m) => m.senderRole === "user",
          );
          if (newUserMessages) {
            api.post(`/api/admin/chats/${userId}/read`).catch(() => {});
          }
          scrollToBottom();
        }
      } catch (err: any) {
        if (initial && !cancelled) {
          toast.error(err.response?.data?.error ?? "Failed to load chat");
        }
      } finally {
        inFlightRef.current = false;
        if (initial && !cancelled) setLoading(false);
      }
    }

    poll(true).then(() => {
      api.post(`/api/admin/chats/${userId}/read`).catch(() => {});
    });
    const interval = setInterval(() => poll(), 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
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
      const res = await api.post("/api/admin/chats/upload", formData, {
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
      const { data } = await api.post(`/api/admin/chats/${userId}/messages`, {
        ...(body ? { body } : {}),
        ...(attachedImageUrl ? { imageUrl: attachedImageUrl } : {}),
      });
      const msg: ChatMessage = data.message;
      if (!seenIdsRef.current.has(msg.id)) {
        seenIdsRef.current.add(msg.id);
        if (!lastTsRef.current || msg.createdAt > lastTsRef.current) {
          lastTsRef.current = msg.createdAt;
        }
        setMessages((prev) => [...prev, msg]);
      }
      setInput("");
      setAttachedImageUrl(null);
      scrollToBottom();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleApprove(deposit: ChatDeposit) {
    setActingDepositId(deposit.id);
    try {
      await api.post(`/api/admin/manual-deposits/${deposit.id}/approve`);
      toast.success(`Approved, wallet credited GHS ${Number(deposit.amountGhs).toFixed(2)}`);
      await refetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to approve deposit");
    } finally {
      setActingDepositId(null);
    }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault();
    if (!rejectingDeposit) return;
    setActingDepositId(rejectingDeposit.id);
    try {
      await api.post(`/api/admin/manual-deposits/${rejectingDeposit.id}/reject`, {
        reason: rejectReason,
      });
      toast.success("Deposit rejected");
      setRejectingDeposit(null);
      setRejectReason("");
      await refetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to reject deposit");
    } finally {
      setActingDepositId(null);
    }
  }

  // The most recent amount the user asked for, either a live-chat top-up
  // message or a pending deposit card; "" when none found.
  function findRequestedAmount() {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.manualDepositId) {
        const deposit = deposits[m.manualDepositId];
        if (deposit?.status === "pending") {
          return Number(deposit.amountGhs).toFixed(2);
        }
      }
      if (m.senderRole === "user" && m.body && /top\s*up/i.test(m.body)) {
        const match = m.body.match(/GHS\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (match) return match[1].replace(/,/g, "");
      }
    }
    return "";
  }

  function openCreditDialog() {
    setCreditAmount(findRequestedAmount());
    setCreditReason("Top-up via live chat");
    setCreditOpen(true);
  }

  // Canned replies for the top-up flow; clicking fills the composer so the
  // admin can edit before sending.
  function buildTemplates() {
    const amount = findRequestedAmount();
    const amountText = amount ? `GHS ${amount}` : "the amount";
    const templates: { label: string; text: string }[] = [];
    if (momoSettings) {
      templates.push({
        label: "Payment instructions",
        text: `To top up ${amountText}, please send the payment to ${momoSettings.network.toUpperCase()} ${momoSettings.accountNumber} (${momoSettings.accountName}), then share your payment screenshot here in this chat.`,
      });
    }
    templates.push(
      {
        label: "Request screenshot",
        text: "Please send your payment screenshot here in the chat so we can confirm your top-up.",
      },
      {
        label: "Payment received",
        text: "We've received your payment and are confirming it now. Your wallet will be credited shortly.",
      },
      {
        label: "Wallet credited",
        text: `Your wallet has been credited with ${amountText}. Thank you!`,
      },
    );
    return templates;
  }

  async function handleCredit(e: FormEvent) {
    e.preventDefault();
    setCrediting(true);
    try {
      await api.post(`/api/admin/users/${userId}/wallet-adjustment`, {
        direction: "credit",
        amountGhs: creditAmount,
        reason: creditReason,
      });
      // Confirm the credit in the thread so the user sees it in chat
      await api
        .post(`/api/admin/chats/${userId}/messages`, {
          body: `Your wallet has been credited with GHS ${Number(creditAmount).toFixed(2)}. ${creditReason}`,
        })
        .catch(() => {});
      toast.success("Wallet credited");
      setCreditOpen(false);
      setCreditAmount("");
      setCreditReason("");
      await refetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to credit wallet");
    } finally {
      setCrediting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/admin/chats")}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
              aria-label="Back to chats"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {(chatUser?.fullName || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink-900">
                {chatUser?.fullName ?? "Loading..."}
              </p>
              <p className="truncate text-xs text-ink-400">{chatUser?.phone ?? ""}</p>
            </div>
            <button
              onClick={openCreditDialog}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition active:scale-95"
            >
              <Wallet size={14} />
              Credit wallet
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-3 px-4 py-4 pb-28">
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 w-2/3 rounded-2xl bg-ink-100 animate-pulse" />
              <div className="ml-auto h-12 w-2/3 rounded-2xl bg-ink-100 animate-pulse" />
              <div className="h-12 w-1/2 rounded-2xl bg-ink-100 animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="text-sm font-semibold text-ink-700">No messages yet</p>
              <p className="mt-1 text-xs text-ink-400">
                Send the first message to start the conversation.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              if (m.senderRole === "system") {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="max-w-[85%] rounded-full bg-ink-100 px-4 py-1.5 text-center text-[11px] font-medium text-ink-600">
                      {m.body}
                    </div>
                  </div>
                );
              }
              const mine = m.senderRole === "admin";
              if (m.manualDepositId) {
                const deposit = deposits[m.manualDepositId];
                const acting = actingDepositId === m.manualDepositId;
                return (
                  <div key={m.id}>
                    <div
                      className={`w-64 rounded-2xl border border-border bg-card p-3.5 shadow-soft ${
                        mine ? "ml-auto" : ""
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
                          <p className="text-[11px] text-ink-400">
                            Ref: {deposit.reference}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${DEPOSIT_STATUS_STYLES[deposit.status]}`}
                            >
                              {deposit.status}
                            </span>
                            {deposit.screenshotUrl && (
                              <a
                                href={deposit.screenshotUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-600 hover:bg-ink-200"
                              >
                                Screenshot
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {deposit.status === "rejected" && deposit.rejectionReason && (
                            <p className="mt-1.5 text-[11px] text-red-600">
                              {deposit.rejectionReason}
                            </p>
                          )}
                          {deposit.status === "pending" && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleApprove(deposit)}
                                disabled={acting}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                              >
                                {acting ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <BadgeCheck size={13} />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingDeposit(deposit);
                                  setRejectReason("");
                                }}
                                disabled={acting}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                <XCircle size={13} />
                                Reject
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-ink-400">
                          Top-up details unavailable
                        </p>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[10px] text-ink-300 ${mine ? "text-right" : ""}`}
                    >
                      {formatChatTime(m.createdAt)}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={m.id}
                  className={mine ? "flex justify-end" : "flex justify-start"}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 shadow-soft ${
                        mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-card text-ink-900"
                      }`}
                    >
                      {m.imageUrl && (
                        <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={m.imageUrl}
                            alt="Attachment"
                            className="mb-1.5 max-h-56 w-full rounded-xl object-cover"
                          />
                        </a>
                      )}
                      {m.body && (
                        <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-[10px] text-ink-300 ${mine ? "text-right" : ""}`}
                    >
                      {formatChatTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md">
          {/* Quick reply templates */}
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {buildTemplates().map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setInput(t.text)}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:border-primary/40 hover:text-primary active:scale-95"
              >
                {t.label}
              </button>
            ))}
          </div>
          {attachedImageUrl && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-background p-2">
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
          <form onSubmit={handleSend} className="flex items-center gap-1.5">
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
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-100 hover:text-ink-600 disabled:opacity-50"
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
              placeholder="Type a reply..."
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-primary/40"
            />
            <button
              type="submit"
              disabled={sending || uploading || (!input.trim() && !attachedImageUrl)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-50"
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

      {/* Reject deposit dialog */}
      {rejectingDeposit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={handleReject}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-soft-lg"
          >
            <h2 className="text-base font-bold text-ink-900">Reject top-up</h2>
            <p className="mt-1 text-xs text-ink-500">
              GHS {Number(rejectingDeposit.amountGhs).toFixed(2)}, ref{" "}
              {rejectingDeposit.reference}. The user will see the reason in chat.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (min 3 characters)"
              rows={3}
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setRejectingDeposit(null)}
                className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejectReason.trim().length < 3 || actingDepositId !== null}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {actingDepositId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credit wallet dialog */}
      {creditOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={handleCredit}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-soft-lg"
          >
            <h2 className="text-base font-bold text-ink-900">Credit wallet</h2>
            <p className="mt-1 text-xs text-ink-500">
              Credits {chatUser?.fullName ?? "this user"}'s wallet and posts a
              confirmation message in the chat.
            </p>
            <label className="mt-3 block text-xs font-semibold text-ink-700">
              Amount (GHS)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
            <label className="mt-3 block text-xs font-semibold text-ink-700">Reason</label>
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="e.g. Top-up via live chat"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/40"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCreditOpen(false)}
                className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  crediting ||
                  !creditAmount ||
                  Number(creditAmount) <= 0 ||
                  creditReason.trim().length < 3
                }
                className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
              >
                {crediting ? "Crediting..." : "Credit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
