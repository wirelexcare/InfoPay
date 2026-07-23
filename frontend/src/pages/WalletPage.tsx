import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Copy,
  Coins,
  CreditCard,
  Gift,
  RefreshCcw,
  Smartphone,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { ImageUpload } from "../components/ImageUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface DepositSettings {
  network: string;
  accountName: string;
  accountNumber: string;
}

interface Wallet {
  balanceGhs: string;
}

interface WalletTransaction {
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "investment"
    | "payout"
    | "refund"
    | "referral_reward"
    | "reward_claim";
  amountGhs: string;
  balanceBeforeGhs: string;
  balanceAfterGhs: string;
  status: "pending" | "completed" | "failed";
  method: string | null;
  reference: string | null;
  description: string | null;
  createdAt: string;
}

interface WithdrawalMethod {
  id: string;
  type: "momo" | "bank" | "crypto";
  accountName: string;
  accountNumber: string | null;
  cryptoAddress: string | null;
}

const METHOD_TYPES: {
  type: "momo" | "bank" | "crypto";
  label: string;
  icon: typeof Smartphone;
}[] = [
  { type: "momo", label: "Mobile Money", icon: Smartphone },
  { type: "bank", label: "Bank Transfer", icon: Building2 },
  { type: "crypto", label: "USDT", icon: Coins },
];

const statusVariant: Record<string, "warning" | "default" | "destructive"> = {
  pending: "warning",
  completed: "default",
  failed: "destructive",
};

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  investment: "Investment",
  payout: "Payout",
  refund: "Refund",
  referral_reward: "Referral Reward",
  reward_claim: "Reward Claim",
  adjustment_credit: "Credit",
  adjustment_debit: "Debit",
};

const typeIcon: Record<string, typeof ArrowDownToLine> = {
  deposit: ArrowDownToLine,
  withdrawal: ArrowUpFromLine,
  investment: Building2,
  payout: TrendingUp,
  refund: RefreshCcw,
  referral_reward: Gift,
  reward_claim: Gift,
  adjustment_credit: ArrowDownToLine,
  adjustment_debit: ArrowUpFromLine,
};

// Transaction types that reduce the wallet balance (shown with a "-").
const DEBIT_TYPES = new Set(["withdrawal", "investment", "adjustment_debit"]);

function RewardsTabContent({ onClaimed }: { onClaimed: () => void }) {
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [lastClaimResult, setLastClaimResult] = useState<{
    status: string;
    claimAmount?: number;
  } | null>(null);

  const handleClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) {
      toast.error("Please enter a reward code");
      return;
    }

    try {
      setClaiming(true);
      const res = await api.post("/api/wallet/rewards/claim", { code: claimCode });

      if (res.data.status === "success") {
        toast.success(
          `You won ₵${res.data.claimAmount}!${res.data.isPoolExhausted ? " (pool exhausted)" : ""}`,
        );
        setLastClaimResult({ status: "success", claimAmount: res.data.claimAmount });
        setClaimCode("");
        onClaimed();
      } else {
        const messages: Record<string, string> = {
          pool_not_found: "Reward code not found",
          pool_inactive: "This reward pool is no longer active",
          pool_expired: "This reward pool has expired",
          already_claimed: "You've already claimed from this reward pool",
          insufficient_pool: "Total reward amount claimed. Try again with the next provided code",
        };
        toast.error(messages[res.data.status] || "Failed to claim reward");
        setLastClaimResult({ status: res.data.status });
      }
    } catch (error: any) {
      const message = error.response?.data?.error || "Failed to claim reward";
      toast.error(message);
      setLastClaimResult({ status: "error" });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-bold text-ink-700 uppercase">Claim a Reward</h3>
        <form onSubmit={handleClaim} className="space-y-3">
          <div>
            <Label htmlFor="rewardCode">Reward Code</Label>
            <Input
              id="rewardCode"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="AH-XXXXXXXX"
              disabled={claiming}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={claiming}
            className="w-full"
          >
            {claiming ? "Claiming..." : "Claim Reward"}
          </Button>
        </form>
      </div>

      {lastClaimResult && lastClaimResult.status === "success" && (
        <Card className="border-green-200 bg-green-50 p-4 text-green-900">
          <p className="text-sm font-medium">
            ✓ Claimed ₵{lastClaimResult.claimAmount?.toFixed(2)}! Check your wallet — it'll show up in Recent transactions below.
          </p>
        </Card>
      )}
    </div>
  );
}

export function WalletPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isGhana = user?.country === "GH";
  const currency = user?.preferredCurrency ?? "GHS";
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<"momo" | "bank" | "crypto">(
    "momo",
  );
  const [depositLoading, setDepositLoading] = useState(false);

  const availableMethodTypes = useMemo(
    () => METHOD_TYPES.filter((m) => m.type === "crypto" || isGhana),
    [isGhana],
  );

  const [withdrawType, setWithdrawType] = useState<"momo" | "bank" | "crypto">(
    "momo",
  );
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethodId, setWithdrawMethodId] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  const [cryptoInvoice, setCryptoInvoice] = useState<{
    payAddress: string;
    payAmount: string;
    payCurrency: string;
  } | null>(null);

  const [cryptoQuote, setCryptoQuote] = useState<{
    ghsPerUsd: number;
    minDepositGhs: number | null;
    minWithdrawGhs: number;
  } | null>(null);

  useEffect(() => {
    api.get("/api/payments/crypto/quote").then(({ data }) => setCryptoQuote(data));
  }, []);

  const [momoSheet, setMomoSheet] = useState<{
    settings: DepositSettings;
    reference: string;
    amountGhs: string;
  } | null>(null);
  const [momoForm, setMomoForm] = useState({
    network: "mtn" as "mtn" | "vodafone" | "telecel" | "airteltigo",
    senderName: "",
    senderNumber: "",
    screenshotUrl: "" as string | null,
  });
  const [momoSubmitting, setMomoSubmitting] = useState(false);

  const methodsForType = methods.filter((m) => m.type === withdrawType);

  function loadWallet() {
    return Promise.all([
      api.get("/api/wallet").then(({ data }) => {
        setWallet(data.wallet);
        setTransactions(data.transactions);
      }),
      api.get("/api/wallet/methods").then(({ data }) => {
        setMethods(data.methods);
      }),
    ]);
  }

  useEffect(() => {
    loadWallet().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isGhana) setWithdrawType("crypto");
  }, [isGhana]);

  useEffect(() => {
    const options = methods.filter((m) => m.type === withdrawType);
    setWithdrawMethodId(options[0]?.id ?? "");
  }, [withdrawType, methods]);

  async function handleDeposit(e: FormEvent) {
    e.preventDefault();
    setDepositLoading(true);
    try {
      if (depositMethod === "crypto") {
        const { data } = await api.post("/api/payments/crypto/create", {
          amountGhs: depositAmount,
        });
        setCryptoInvoice({
          payAddress: data.payAddress,
          payAmount: data.payAmount,
          payCurrency: data.payCurrency,
        });
        setDepositAmount("");
      } else {
        const [settingsRes, referenceRes] = await Promise.all([
          api.get("/api/wallet/deposit-settings"),
          api.get("/api/wallet/manual-deposits/reference"),
        ]);
        setMomoForm({
          network: "mtn",
          senderName: "",
          senderNumber: "",
          screenshotUrl: null,
        });
        setMomoSheet({
          settings: settingsRes.data.settings,
          reference: referenceRes.data.reference,
          amountGhs: depositAmount,
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Could not start deposit");
    } finally {
      setDepositLoading(false);
    }
  }

  async function handleMomoSubmit(e: FormEvent) {
    e.preventDefault();
    if (!momoSheet) return;
    if (!momoForm.screenshotUrl) {
      toast.error("Please upload your payment screenshot");
      return;
    }
    setMomoSubmitting(true);
    try {
      await api.post("/api/wallet/manual-deposits", {
        reference: momoSheet.reference,
        amountGhs: momoSheet.amountGhs,
        network: momoForm.network,
        senderName: momoForm.senderName,
        senderNumber: momoForm.senderNumber,
        screenshotUrl: momoForm.screenshotUrl,
      });
      toast.success("Submitted, track it in live chat");
      setMomoSheet(null);
      setDepositAmount("");
      navigate("/chat");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to submit deposit");
    } finally {
      setMomoSubmitting(false);
    }
  }

  async function copyAddress() {
    if (!cryptoInvoice) return;
    await navigator.clipboard.writeText(cryptoInvoice.payAddress);
    toast.success("Address copied");
  }

  async function handleWithdraw(e: FormEvent) {
    e.preventDefault();
    setWithdrawLoading(true);
    try {
      await api.post("/api/wallet/withdraw", {
        amountGhs: withdrawAmount,
        methodId: withdrawMethodId,
      });
      toast.success("Withdrawal requested");
      setWithdrawAmount("");
      await loadWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Withdrawal failed");
    } finally {
      setWithdrawLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  const balance = Number(wallet?.balanceGhs ?? 0);

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Wallet
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Top up, withdraw, and track your balance.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-sky-600 p-5 text-white shadow-soft-lg">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/70">
          <WalletIcon size={14} />
          Available balance
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">
          {formatCurrency(convertFromGhs(balance, currency), currency)}
        </p>
      </div>

      <Tabs defaultValue="deposit">
        <TabsList>
          <TabsTrigger value="deposit">
            <ArrowDownToLine size={15} />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <ArrowUpFromLine size={15} />
            Withdraw
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift size={15} />
            Rewards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <Card className="p-4">
            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <Label htmlFor="depositAmount">Amount (GHS)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  min="1"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="500"
                />
                {depositMethod === "crypto" && cryptoQuote && (
                  <p className="mt-1 text-xs text-ink-400">
                    1 USD ≈ GHS {cryptoQuote.ghsPerUsd.toFixed(2)}
                    {cryptoQuote.minDepositGhs !== null && (
                      <>
                        {" "}
                        · Minimum deposit: GHS{" "}
                        {cryptoQuote.minDepositGhs.toFixed(2)}
                      </>
                    )}
                  </p>
                )}
              </div>
              <div>
                <Label>Method</Label>
                <Select
                  value={depositMethod}
                  onValueChange={(v) => setDepositMethod(v as typeof depositMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momo">Mobile Money</SelectItem>
                    <SelectItem value="crypto">USDT (Crypto)</SelectItem>
                  </SelectContent>
                </Select>
                {depositMethod === "momo" && (
                  <p className="mt-1.5 text-xs text-ink-400">
                    You'll pay to our mobile money account and upload proof —
                    your wallet is credited after a quick manual review.
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={depositLoading}
                className="w-full"
              >
                {depositLoading
                  ? "Processing…"
                  : depositMethod === "crypto"
                    ? "Get deposit address"
                    : "Get payment instructions"}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {availableMethodTypes.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWithdrawType(type)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition active:scale-95 ${
                    withdrawType === type
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-ink-500 hover:border-ink-300"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            <Card className="p-4">
              {methodsForType.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CreditCard size={22} className="text-ink-400" />
                  <p className="text-sm text-ink-600">
                    You haven't set up a{" "}
                    {METHOD_TYPES.find((m) => m.type === withdrawType)?.label}{" "}
                    withdrawal method yet.
                  </p>
                  <Link
                    to="/dashboard"
                    className="mt-1 text-sm font-semibold text-primary"
                  >
                    Set it up now
                  </Link>
                  {availableMethodTypes.some(
                    (m) =>
                      m.type !== withdrawType &&
                      methods.some((wm) => wm.type === m.type),
                  ) && (
                    <p className="text-xs text-ink-400">
                      or choose a different method above
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div>
                    <Label htmlFor="withdrawAmount">Amount (GHS)</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      min="1"
                      max={balance}
                      required
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="500"
                    />
                    <p className="mt-1 text-xs text-ink-400">
                      Available:{" "}
                      {formatCurrency(convertFromGhs(balance, currency), currency)}
                      {withdrawType === "crypto" && cryptoQuote && (
                        <>
                          {" "}
                          · Minimum: GHS {cryptoQuote.minWithdrawGhs.toFixed(2)}
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <Label>Send to</Label>
                    <Select value={withdrawMethodId} onValueChange={setWithdrawMethodId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {methodsForType.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.accountName}
                            {m.accountNumber || m.cryptoAddress
                              ? ` · ${m.accountNumber ?? m.cryptoAddress}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={withdrawLoading}
                    className="w-full"
                  >
                    {withdrawLoading ? "Processing…" : "Request withdrawal"}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rewards">
          <Card className="p-4">
            <RewardsTabContent onClaimed={loadWallet} />
          </Card>
        </TabsContent>
      </Tabs>

      <div>
        <h2 className="mb-3 text-sm font-bold text-ink-900">
          Recent transactions
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-400">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => setSelectedTx(tx)}
                className="block w-full text-left active:scale-[0.99] transition"
              >
                <Card className="flex items-center justify-between px-4 py-3 transition hover:border-primary/30">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {typeLabels[tx.type] ?? tx.type}
                    </p>
                    <p className="text-xs text-ink-400">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-900">
                      {DEBIT_TYPES.has(tx.type) ? "-" : "+"}
                      {formatCurrency(
                        convertFromGhs(Number(tx.amountGhs), currency),
                        currency,
                      )}
                    </p>
                    <Badge variant={statusVariant[tx.status]} className="text-[10px]">
                      {tx.status}
                    </Badge>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        {selectedTx && (
          <SheetContent title="Transaction details">
            {(() => {
              const Icon = typeIcon[selectedTx.type] ?? WalletIcon;
              const isCredit = !DEBIT_TYPES.has(selectedTx.type);
              return (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Icon size={24} />
                    </div>
                    <p className="text-2xl font-extrabold tracking-tight text-ink-900">
                      {isCredit ? "+" : "-"}
                      {formatCurrency(
                        convertFromGhs(Number(selectedTx.amountGhs), currency),
                        currency,
                      )}
                    </p>
                    <Badge variant={statusVariant[selectedTx.status]} className="capitalize">
                      {selectedTx.status}
                    </Badge>
                  </div>

                  <Card className="divide-y divide-border p-0">
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-400">Type</span>
                      <span className="font-medium text-ink-900">
                        {typeLabels[selectedTx.type] ?? selectedTx.type}
                      </span>
                    </div>
                    {selectedTx.description && (
                      <div className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-ink-400">Description</span>
                        <span className="max-w-[60%] text-right font-medium text-ink-900">
                          {selectedTx.description}
                        </span>
                      </div>
                    )}
                    {selectedTx.method && (
                      <div className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-ink-400">Method</span>
                        <span className="font-medium capitalize text-ink-900">
                          {selectedTx.method}
                        </span>
                      </div>
                    )}
                    {selectedTx.reference && (
                      <div className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-ink-400">Reference</span>
                        <span className="font-medium text-ink-900">
                          {selectedTx.reference}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-400">Balance before</span>
                      <span className="font-medium text-ink-900">
                        {formatCurrency(
                          convertFromGhs(Number(selectedTx.balanceBeforeGhs), currency),
                          currency,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-400">Balance after</span>
                      <span className="font-medium text-ink-900">
                        {formatCurrency(
                          convertFromGhs(Number(selectedTx.balanceAfterGhs), currency),
                          currency,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-400">Date</span>
                      <span className="font-medium text-ink-900">
                        {new Date(selectedTx.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </Card>
                </div>
              );
            })()}
          </SheetContent>
        )}
      </Sheet>

      <Sheet open={!!cryptoInvoice} onOpenChange={(open) => !open && setCryptoInvoice(null)}>
        {cryptoInvoice && (
          <SheetContent title="Send USDT to complete deposit">
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Send exactly the amount below on the <strong>TRC20</strong>{" "}
                network. Your wallet is credited automatically once the
                network confirms — no need to stay on this screen.
              </div>

              <div className="text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Amount to send
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">
                  {cryptoInvoice.payAmount} {cryptoInvoice.payCurrency?.toUpperCase()}
                </p>
              </div>

              <div>
                <Label>Deposit address (TRC20)</Label>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-3 shadow-soft">
                  <code className="min-w-0 flex-1 break-all text-xs text-ink-900">
                    {cryptoInvoice.payAddress}
                  </code>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-900 active:scale-95"
                    aria-label="Copy address"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>

              <Button
                onClick={() => setCryptoInvoice(null)}
                size="lg"
                className="w-full"
              >
                Done
              </Button>
            </div>
          </SheetContent>
        )}
      </Sheet>

      <Sheet open={!!momoSheet} onOpenChange={(open) => !open && setMomoSheet(null)}>
        {momoSheet && (
          <SheetContent title="Complete your mobile money deposit">
            <form onSubmit={handleMomoSubmit} className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Pay{" "}
                <strong>
                  {formatCurrency(
                    convertFromGhs(Number(momoSheet.amountGhs), currency),
                    currency,
                  )}
                </strong>{" "}
                to the account below, using{" "}
                <strong>{momoSheet.reference}</strong> as the payment
                reference. Then fill in the details you paid with and upload
                your screenshot. Your wallet is credited after a quick manual
                review — usually just a few minutes.
              </div>

              <Card className="divide-y divide-border p-0">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink-400">Network</span>
                  <span className="font-medium uppercase text-ink-900">
                    {momoSheet.settings.network}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink-400">Account name</span>
                  <span className="font-medium text-ink-900">
                    {momoSheet.settings.accountName}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink-400">Number</span>
                  <span className="font-medium text-ink-900">
                    {momoSheet.settings.accountNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ink-400">Reference</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-ink-900">
                      {momoSheet.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(momoSheet.reference);
                        toast.success("Reference copied");
                      }}
                      className="grid h-6 w-6 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                      aria-label="Copy reference"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </Card>

              <div>
                <Label>Network you paid from</Label>
                <Select
                  value={momoForm.network}
                  onValueChange={(v) =>
                    setMomoForm((f) => ({ ...f, network: v as typeof f.network }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN</SelectItem>
                    <SelectItem value="vodafone">Vodafone Cash</SelectItem>
                    <SelectItem value="telecel">Telecel Cash</SelectItem>
                    <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="senderName">Name on the account you paid with</Label>
                <Input
                  id="senderName"
                  required
                  value={momoForm.senderName}
                  onChange={(e) =>
                    setMomoForm((f) => ({ ...f, senderName: e.target.value }))
                  }
                  placeholder="Ama Owusu"
                />
              </div>

              <div>
                <Label htmlFor="senderNumber">Number you paid with</Label>
                <Input
                  id="senderNumber"
                  required
                  value={momoForm.senderNumber}
                  onChange={(e) =>
                    setMomoForm((f) => ({ ...f, senderNumber: e.target.value }))
                  }
                  placeholder="0240000000"
                />
              </div>

              <div>
                <Label>Payment screenshot</Label>
                <ImageUpload
                  value={momoForm.screenshotUrl}
                  onChange={(url) => setMomoForm((f) => ({ ...f, screenshotUrl: url }))}
                  endpoint="/api/wallet/manual-deposits/screenshot"
                  fieldName="screenshot"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={momoSubmitting}
                className="w-full"
              >
                {momoSubmitting ? "Submitting…" : "I've made the payment"}
              </Button>
            </form>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
