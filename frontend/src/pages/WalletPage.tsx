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

interface BinancePayAccount {
  id: string;
  binanceId: string;
  label: string;
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

const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  pool_not_found: "Reward code not found",
  pool_inactive: "This reward pool is no longer active",
  pool_expired: "This reward pool has expired",
  already_claimed: "You've already claimed from this reward pool",
  insufficient_pool: "Total reward amount claimed. Try again with the next provided code",
};

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
          `You won ₵${Number(res.data.claimAmount).toFixed(2)}!${res.data.isPoolExhausted ? " (pool exhausted)" : ""}`,
        );
        setLastClaimResult({ status: "success", claimAmount: res.data.claimAmount });
        setClaimCode("");
        onClaimed();
      } else {
        toast.error(CLAIM_ERROR_MESSAGES[res.data.status] || "Failed to claim reward");
        setLastClaimResult({ status: res.data.status });
      }
    } catch (error: any) {
      // 400/404/409 responses land here, so map their status/message too
      const data = error.response?.data;
      const message =
        (data?.status && CLAIM_ERROR_MESSAGES[data.status]) ||
        data?.message ||
        (typeof data?.error === "string" ? data.error : null) ||
        "Failed to claim reward";
      toast.error(message);
      setLastClaimResult({ status: data?.status ?? "error" });
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
  const [depositMethod, setDepositMethod] = useState<
    "momo" | "bank" | "crypto" | "chat" | "binancePay"
  >("chat");
  // Contact number sent along with a live-chat top-up request
  const [depositPhone, setDepositPhone] = useState(user?.phone ?? "");
  const [depositLoading, setDepositLoading] = useState(false);

  // Which deposit methods the admin has enabled; all shown until loaded.
  const [enabledDepositMethods, setEnabledDepositMethods] = useState<{
    momo: boolean;
    crypto: boolean;
    chat: boolean;
    binancePay: boolean;
  }>({ momo: true, crypto: true, chat: true, binancePay: true });

  useEffect(() => {
    api
      .get("/api/wallet/deposit-methods")
      .then(({ data }) => {
        setEnabledDepositMethods({
          momo: data.momo ?? true,
          crypto: data.crypto ?? true,
          chat: data.chat ?? true,
          binancePay: data.binancePay ?? true,
        });
      })
      .catch(() => {});
  }, []);

  // Keep the selected method valid when the admin has hidden it.
  useEffect(() => {
    const order: ("momo" | "crypto" | "chat" | "binancePay")[] = [
      "chat",
      "momo",
      "crypto",
      "binancePay",
    ];
    if (
      depositMethod !== "bank" &&
      !enabledDepositMethods[depositMethod as "momo" | "crypto" | "chat" | "binancePay"]
    ) {
      const first = order.find((m) => enabledDepositMethods[m]);
      if (first) setDepositMethod(first);
    }
  }, [enabledDepositMethods, depositMethod]);

  const availableMethodTypes = useMemo(
    () => METHOD_TYPES.filter((m) => m.type === "crypto" || isGhana),
    [isGhana],
  );

  // Platform-wide limits, fees, and withdrawal windows set by the admin.
  const [paymentRules, setPaymentRules] = useState<{
    momoMinDepositGhs: number | null;
    momoMaxDepositGhs: number | null;
    momoDepositFeePct: number;
    cryptoMinDepositGhs: number | null;
    cryptoMaxDepositGhs: number | null;
    binanceMinDepositGhs: number | null;
    binanceMaxDepositGhs: number | null;
    binanceDepositFeePct: number;
    minWithdrawalGhs: number | null;
    maxWithdrawalGhs: number | null;
    withdrawalFeePct: number;
    withdrawalOpenNow: boolean;
    withdrawalClosedReason: string | null;
  } | null>(null);

  useEffect(() => {
    api
      .get("/api/payment-rules")
      .then(({ data }) => setPaymentRules(data))
      .catch(() => {});
  }, []);

  function limitsHint(min: number | null, max: number | null, feePct: number) {
    const parts: string[] = [];
    if (min !== null) parts.push(`Min GHS ${min.toFixed(2)}`);
    if (max !== null) parts.push(`Max GHS ${max.toFixed(2)}`);
    if (feePct > 0) parts.push(`${feePct}% fee applies`);
    return parts.join(" · ");
  }

  // Every deposit path (momo, crypto, and the chat-assisted request) must
  // respect the admin-configured min/max for that method — the chat path in
  // particular just posts free text with no server-side amount check, so
  // this is the only thing stopping an out-of-range top-up request from
  // being submitted.
  function validateDepositAmount(
    amount: number,
    method: "momo" | "bank" | "crypto" | "chat" | "binancePay",
  ): string | null {
    if (!(amount > 0)) return "Enter a valid amount";
    if (!paymentRules) return null;

    if (method === "crypto") {
      const min = paymentRules.cryptoMinDepositGhs ?? cryptoQuote?.minDepositGhs ?? null;
      const max = paymentRules.cryptoMaxDepositGhs;
      if (min !== null && amount < min) {
        return `Minimum deposit is GHS ${min.toFixed(2)}`;
      }
      if (max !== null && amount > max) {
        return `Maximum deposit is GHS ${max.toFixed(2)}`;
      }
      return null;
    }

    if (method === "binancePay") {
      const min = paymentRules.binanceMinDepositGhs;
      const max = paymentRules.binanceMaxDepositGhs;
      if (min !== null && amount < min) {
        return `Minimum deposit is GHS ${min.toFixed(2)}`;
      }
      if (max !== null && amount > max) {
        return `Maximum deposit is GHS ${max.toFixed(2)}`;
      }
      return null;
    }

    if (paymentRules.momoMinDepositGhs !== null && amount < paymentRules.momoMinDepositGhs) {
      return `Minimum deposit is GHS ${paymentRules.momoMinDepositGhs.toFixed(2)}`;
    }
    if (paymentRules.momoMaxDepositGhs !== null && amount > paymentRules.momoMaxDepositGhs) {
      return `Maximum deposit is GHS ${paymentRules.momoMaxDepositGhs.toFixed(2)}`;
    }
    return null;
  }

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
    const fetchQuote = () =>
      api.get("/api/payments/crypto/quote").then(({ data }) => setCryptoQuote(data));
    fetchQuote();
    const interval = setInterval(fetchQuote, 60_000);
    return () => clearInterval(interval);
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

  const [binanceSheet, setBinanceSheet] = useState<{
    accounts: BinancePayAccount[];
    reference: string;
    amountGhs: string;
  } | null>(null);
  const [binanceForm, setBinanceForm] = useState({
    accountId: "",
    senderBinanceId: "",
    senderEmail: "",
    senderName: "",
    screenshotUrl: "" as string | null,
  });
  const [binanceSubmitting, setBinanceSubmitting] = useState(false);

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
    const validationError = validateDepositAmount(Number(depositAmount), depositMethod);
    if (validationError) {
      toast.error(validationError);
      return;
    }
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
      } else if (depositMethod === "chat") {
        // Post the top-up intent into the live chat and take the user there;
        // an admin arranges the payment and credits the wallet from the chat.
        if (depositPhone.trim().length < 7) {
          toast.error("Please enter a valid phone number");
          return;
        }
        await api.post("/api/chat/messages", {
          body: `Hi, I'd like to top up my account with GHS ${Number(depositAmount).toFixed(2)}. You can reach me on ${depositPhone.trim()}.`,
        });
        setDepositAmount("");
        navigate("/chat");
      } else if (depositMethod === "binancePay") {
        const [accountsRes, referenceRes] = await Promise.all([
          api.get("/api/wallet/binance-pay-accounts"),
          api.get("/api/wallet/manual-deposits/reference"),
        ]);
        if (!accountsRes.data.accounts?.length) {
          toast.error("No Binance Pay accounts are available right now. Please try another method.");
          return;
        }
        setBinanceForm({
          accountId: accountsRes.data.accounts[0].id,
          senderBinanceId: "",
          senderEmail: "",
          senderName: "",
          screenshotUrl: null,
        });
        setBinanceSheet({
          accounts: accountsRes.data.accounts,
          reference: referenceRes.data.reference,
          amountGhs: depositAmount,
        });
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

  async function handleBinanceSubmit(e: FormEvent) {
    e.preventDefault();
    if (!binanceSheet) return;
    if (!binanceForm.screenshotUrl) {
      toast.error("Please upload your payment screenshot");
      return;
    }
    setBinanceSubmitting(true);
    try {
      await api.post("/api/wallet/manual-deposits", {
        method: "binance_pay",
        reference: binanceSheet.reference,
        amountGhs: binanceSheet.amountGhs,
        binanceAccountId: binanceForm.accountId,
        senderBinanceId: binanceForm.senderBinanceId,
        senderEmail: binanceForm.senderEmail,
        senderName: binanceForm.senderName,
        screenshotUrl: binanceForm.screenshotUrl,
      });
      toast.success("Submitted, track it in live chat");
      setBinanceSheet(null);
      setDepositAmount("");
      navigate("/chat");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to submit deposit");
    } finally {
      setBinanceSubmitting(false);
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
                  <>
                    <p className="mt-1 text-xs text-ink-400">
                      1 USD ≈ GHS {cryptoQuote.ghsPerUsd.toFixed(2)}
                      {cryptoQuote.minDepositGhs !== null && (
                        <>
                          {" "}
                          · Minimum deposit: GHS{" "}
                          {cryptoQuote.minDepositGhs.toFixed(2)}
                        </>
                      )}
                      {paymentRules?.cryptoMaxDepositGhs != null && (
                        <>
                          {" "}
                          · Maximum deposit: GHS{" "}
                          {paymentRules.cryptoMaxDepositGhs.toFixed(2)}
                        </>
                      )}
                    </p>
                    {cryptoQuote.minDepositGhs !== null && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        This minimum changes with the crypto market and updates
                        automatically while you're on this page.
                      </p>
                    )}
                    <p className="mt-0.5 text-xs font-medium text-ink-600">
                      No deposit fee for crypto top-ups.
                    </p>
                  </>
                )}
                {paymentRules &&
                  depositMethod !== "crypto" &&
                  depositMethod !== "binancePay" &&
                  limitsHint(
                    paymentRules.momoMinDepositGhs,
                    paymentRules.momoMaxDepositGhs,
                    0,
                  ) && (
                    <p className="mt-1 text-xs text-ink-400">
                      {limitsHint(
                        paymentRules.momoMinDepositGhs,
                        paymentRules.momoMaxDepositGhs,
                        0,
                      )}
                    </p>
                  )}
                {paymentRules &&
                  depositMethod !== "crypto" &&
                  depositMethod !== "binancePay" &&
                  paymentRules.momoDepositFeePct > 0 &&
                  Number(depositAmount) > 0 && (
                    <p className="mt-1 text-xs font-medium text-ink-600">
                      You'll pay GHS{" "}
                      {(
                        Number(depositAmount) *
                        (1 + paymentRules.momoDepositFeePct / 100)
                      ).toFixed(2)}{" "}
                      (GHS {Number(depositAmount).toFixed(2)} +{" "}
                      {paymentRules.momoDepositFeePct}% fee) and receive GHS{" "}
                      {Number(depositAmount).toFixed(2)} in your wallet
                    </p>
                  )}
                {depositMethod === "binancePay" && paymentRules && (
                  <>
                    {limitsHint(
                      paymentRules.binanceMinDepositGhs,
                      paymentRules.binanceMaxDepositGhs,
                      0,
                    ) && (
                      <p className="mt-1 text-xs text-ink-400">
                        {limitsHint(
                          paymentRules.binanceMinDepositGhs,
                          paymentRules.binanceMaxDepositGhs,
                          0,
                        )}
                      </p>
                    )}
                    {paymentRules.binanceDepositFeePct > 0 && Number(depositAmount) > 0 && (
                      <p className="mt-1 text-xs font-medium text-ink-600">
                        You'll pay GHS{" "}
                        {(
                          Number(depositAmount) *
                          (1 + paymentRules.binanceDepositFeePct / 100)
                        ).toFixed(2)}{" "}
                        (GHS {Number(depositAmount).toFixed(2)} +{" "}
                        {paymentRules.binanceDepositFeePct}% fee) and receive GHS{" "}
                        {Number(depositAmount).toFixed(2)} in your wallet
                      </p>
                    )}
                  </>
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
                    {enabledDepositMethods.momo && (
                      <SelectItem value="momo">Mobile Money</SelectItem>
                    )}
                    {enabledDepositMethods.crypto && (
                      <SelectItem value="crypto">USDT (Crypto)</SelectItem>
                    )}
                    {enabledDepositMethods.binancePay && (
                      <SelectItem value="binancePay">Binance Pay</SelectItem>
                    )}
                    {enabledDepositMethods.chat && (
                      <SelectItem value="chat">Live Chat(Momo)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {depositMethod === "momo" && (
                  <p className="mt-1.5 text-xs text-ink-400">
                    You'll pay to our mobile money account and upload proof —
                    your wallet is credited after a quick manual review.
                  </p>
                )}
                {depositMethod === "binancePay" && (
                  <p className="mt-1.5 text-xs text-ink-400">
                    You'll pick one of our team's Binance Pay IDs, pay there via
                    Binance, and upload proof — your wallet is credited after a
                    quick manual review.
                  </p>
                )}
                {depositMethod === "chat" && (
                  <p className="mt-1.5 text-xs text-ink-400">
                    You'll be taken to a live chat with our team to arrange the
                    top-up. Your wallet is credited once payment is confirmed.
                  </p>
                )}
              </div>
              {depositMethod === "chat" && (
                <div>
                  <Label htmlFor="depositPhone">Phone number</Label>
                  <Input
                    id="depositPhone"
                    type="tel"
                    required
                    minLength={7}
                    value={depositPhone}
                    onChange={(e) => setDepositPhone(e.target.value)}
                    placeholder="0240000000"
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    Included in your message so our team can reach you.
                  </p>
                </div>
              )}
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
                    : depositMethod === "chat"
                      ? "Continue in live chat"
                      : depositMethod === "binancePay"
                        ? "Choose a Binance Pay ID"
                        : "Get payment instructions"}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw">
          <div className="space-y-4">
            {paymentRules && !paymentRules.withdrawalOpenNow && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {paymentRules.withdrawalClosedReason ??
                  "Withdrawals are currently closed. Please check back later."}
              </div>
            )}
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
                    {paymentRules &&
                      limitsHint(
                        paymentRules.minWithdrawalGhs,
                        paymentRules.maxWithdrawalGhs,
                        paymentRules.withdrawalFeePct,
                      ) && (
                        <p className="mt-1 text-xs text-ink-400">
                          {limitsHint(
                            paymentRules.minWithdrawalGhs,
                            paymentRules.maxWithdrawalGhs,
                            paymentRules.withdrawalFeePct,
                          )}
                        </p>
                      )}
                    {paymentRules &&
                      paymentRules.withdrawalFeePct > 0 &&
                      Number(withdrawAmount) > 0 && (
                        <p className="mt-1 text-xs font-medium text-ink-600">
                          You'll receive GHS{" "}
                          {(
                            Number(withdrawAmount) *
                            (1 - paymentRules.withdrawalFeePct / 100)
                          ).toFixed(2)}{" "}
                          after the {paymentRules.withdrawalFeePct}% fee
                        </p>
                      )}
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
              {(() => {
                const feePct = paymentRules?.momoDepositFeePct ?? 0;
                const intended = Number(momoSheet.amountGhs);
                const total = Math.round(intended * (1 + feePct / 100) * 100) / 100;
                return (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Pay{" "}
                    <strong>
                      {formatCurrency(convertFromGhs(total, currency), currency)}
                    </strong>{" "}
                    to the account below, using{" "}
                    <strong>{momoSheet.reference}</strong> as the payment
                    reference.
                    {feePct > 0 && (
                      <>
                        {" "}
                        This includes a {feePct}% fee; GHS{" "}
                        {intended.toFixed(2)} will be credited to your wallet.
                      </>
                    )}{" "}
                    Then fill in the details you paid with and upload your
                    screenshot. Your wallet is credited after a quick manual
                    review, usually just a few minutes.
                  </div>
                );
              })()}

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

      <Sheet open={!!binanceSheet} onOpenChange={(open) => !open && setBinanceSheet(null)}>
        {binanceSheet &&
          (() => {
            const chosenAccount = binanceSheet.accounts.find(
              (a) => a.id === binanceForm.accountId,
            );
            const feePct = paymentRules?.binanceDepositFeePct ?? 0;
            const intended = Number(binanceSheet.amountGhs);
            const total = Math.round(intended * (1 + feePct / 100) * 100) / 100;
            return (
              <SheetContent title="Complete your Binance Pay deposit">
                <form onSubmit={handleBinanceSubmit} className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Pay{" "}
                    <strong>
                      {formatCurrency(convertFromGhs(total, currency), currency)}
                    </strong>{" "}
                    (in USDT/BUSD at the current rate) to the Binance Pay ID
                    below via the Binance app, using{" "}
                    <strong>{binanceSheet.reference}</strong> as the payment
                    reference/note if Binance allows one.
                    {feePct > 0 && (
                      <>
                        {" "}
                        This includes a {feePct}% fee; GHS{" "}
                        {intended.toFixed(2)} will be credited to your wallet.
                      </>
                    )}{" "}
                    Then fill in your details and upload your screenshot. Your
                    wallet is credited after a quick manual review.
                  </div>

                  <div>
                    <Label>Pay to</Label>
                    <Select
                      value={binanceForm.accountId}
                      onValueChange={(v) =>
                        setBinanceForm((f) => ({ ...f, accountId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {binanceSheet.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {chosenAccount && (
                    <Card className="divide-y divide-border p-0">
                      <div className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-ink-400">Binance Pay ID</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-ink-900">
                            {chosenAccount.binanceId}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(chosenAccount.binanceId);
                              toast.success("Binance Pay ID copied");
                            }}
                            className="grid h-6 w-6 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                            aria-label="Copy Binance Pay ID"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 text-sm">
                        <span className="text-ink-400">Reference</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-ink-900">
                            {binanceSheet.reference}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(binanceSheet.reference);
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
                  )}

                  <div>
                    <Label htmlFor="binanceSenderId">Your Binance ID</Label>
                    <Input
                      id="binanceSenderId"
                      required
                      value={binanceForm.senderBinanceId}
                      onChange={(e) =>
                        setBinanceForm((f) => ({ ...f, senderBinanceId: e.target.value }))
                      }
                      placeholder="123456789"
                    />
                  </div>

                  <div>
                    <Label htmlFor="binanceEmail">Your Binance email</Label>
                    <Input
                      id="binanceEmail"
                      type="email"
                      required
                      value={binanceForm.senderEmail}
                      onChange={(e) =>
                        setBinanceForm((f) => ({ ...f, senderEmail: e.target.value }))
                      }
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="binanceNickname">Your Binance nickname</Label>
                    <Input
                      id="binanceNickname"
                      required
                      value={binanceForm.senderName}
                      onChange={(e) =>
                        setBinanceForm((f) => ({ ...f, senderName: e.target.value }))
                      }
                      placeholder="How your name shows on Binance"
                    />
                  </div>

                  <div>
                    <Label>Payment screenshot</Label>
                    <ImageUpload
                      value={binanceForm.screenshotUrl}
                      onChange={(url) =>
                        setBinanceForm((f) => ({ ...f, screenshotUrl: url }))
                      }
                      endpoint="/api/wallet/manual-deposits/screenshot"
                      fieldName="screenshot"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={binanceSubmitting}
                    className="w-full"
                  >
                    {binanceSubmitting ? "Submitting…" : "I've made the payment"}
                  </Button>
                </form>
              </SheetContent>
            );
          })()}
      </Sheet>
    </div>
  );
}
