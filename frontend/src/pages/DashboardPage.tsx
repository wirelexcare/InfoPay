import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  Coins,
  Gift,
  Info,
  Loader2,
  Plus,
  ShieldAlert,
  Smartphone,
  Trash2,
  Trophy,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { COUNTRIES } from "../lib/countries";
import { Skeleton } from "../components/ui/skeleton";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sheet, SheetContent } from "../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface Portfolio {
  totalInvestedGhs: string;
  totalReturnsGhs: string;
}

interface WithdrawalMethod {
  id: string;
  type: "momo" | "bank" | "crypto";
  network: string | null;
  accountName: string;
  accountNumber: string | null;
  cryptoAddress: string | null;
  isDefault: boolean;
}

interface Bank {
  code: string;
  name: string;
}

const methodIcon: Record<string, typeof Smartphone> = {
  momo: Smartphone,
  bank: Building2,
  crypto: Coins,
};

const kycBadgeVariant: Record<string, "default" | "warning" | "destructive"> = {
  verified: "default",
  pending: "warning",
  rejected: "destructive",
};

const emptyMethodForm = (type: "momo" | "bank" | "crypto") => ({
  type,
  network: "",
  accountName: "",
  accountNumber: "",
  cryptoAddress: "",
  isDefault: false,
});

const QUICK_ACTIONS: {
  to: string;
  label: string;
  icon: typeof Building2;
  tile: string;
  fg: string;
}[] = [
  { to: "/packages", label: "Invest", icon: Building2, tile: "bg-sky-100", fg: "text-sky-600" },
  { to: "/wallet", label: "Add money", icon: ArrowDownToLine, tile: "bg-emerald-100", fg: "text-emerald-600" },
  { to: "/wallet", label: "Withdraw", icon: ArrowUpFromLine, tile: "bg-amber-100", fg: "text-amber-600" },
  { to: "/about", label: "About us", icon: Info, tile: "bg-violet-100", fg: "text-violet-600" },
  { to: "/referrals", label: "Refer & earn", icon: Gift, tile: "bg-rose-100", fg: "text-rose-600" },
  { to: "/wallet", label: "Rewards", icon: Trophy, tile: "bg-indigo-100", fg: "text-indigo-600" },
];

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isGhana = user?.country === "GH";
  const currency = user?.preferredCurrency ?? "GHS";
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [form, setForm] = useState(emptyMethodForm(isGhana ? "momo" : "crypto"));
  const [saving, setSaving] = useState(false);

  const [nameVerified, setNameVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/users/me/portfolio")
      .then(({ data }) => setPortfolio(data.portfolio))
      .finally(() => setLoading(false));
  }, []);

  function loadMethods() {
    return api.get("/api/wallet/methods").then(({ data }) => {
      setMethods(data.methods);
    });
  }

  useEffect(() => {
    loadMethods().finally(() => setMethodsLoading(false));
  }, []);

  useEffect(() => {
    if (isGhana) {
      api.get("/api/wallet/banks").then(({ data }) => setBanks(data.banks));
    }
  }, [isGhana]);

  useEffect(() => {
    setNameVerified(false);
    setVerifyError(null);

    const isMomo =
      form.type === "momo" && form.network && form.accountNumber.length >= 9;
    const isBank =
      form.type === "bank" && form.network && form.accountNumber.length >= 6;
    if (!isMomo && !isBank) return;

    const timeout = setTimeout(async () => {
      setVerifying(true);
      try {
        const { data } =
          form.type === "momo"
            ? await api.post("/api/wallet/verify-momo-name", {
                phoneNumber: form.accountNumber,
                network: form.network,
              })
            : await api.post("/api/wallet/verify-bank-name", {
                accountNumber: form.accountNumber,
                bankCode: form.network,
              });
        setForm((f) => ({ ...f, accountName: data.name }));
        setNameVerified(true);
      } catch (err: any) {
        setVerifyError(
          err.response?.data?.error ?? "Could not verify this account",
        );
      } finally {
        setVerifying(false);
      }
    }, 700);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.network, form.accountNumber]);

  function handleTypeChange(type: "momo" | "bank" | "crypto") {
    setForm(emptyMethodForm(type));
    setNameVerified(false);
    setVerifyError(null);
  }

  function openForm() {
    setForm(emptyMethodForm(isGhana ? "momo" : "crypto"));
    setNameVerified(false);
    setVerifyError(null);
    setShowForm(true);
  }

  async function handleAddMethod(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/wallet/methods", form);
      toast.success("Withdrawal method saved");
      setShowForm(false);
      await loadMethods();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Could not add withdrawal method");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/wallet/methods/${id}`);
    toast.success("Withdrawal method removed");
    await loadMethods();
  }

  const countryName =
    COUNTRIES.find((c) => c.code === user?.country)?.name ?? user?.country;

  return (
    <div className="pb-2 animate-in fade-in-0 duration-300">
      <div className="-mx-4 -mt-16 bg-gradient-to-br from-primary to-sky-600 px-4 pb-14 pt-24 text-white sm:-mx-6 sm:px-6">
        {loading ? (
          <Skeleton className="h-20 w-56 rounded-xl bg-white/20" />
        ) : (
          <div>
            <p className="text-sm text-white/70">Total invested</p>
            <p className="mt-1 text-[2.75rem] font-extrabold leading-none tracking-tight">
              {formatCurrency(
                convertFromGhs(Number(portfolio?.totalInvestedGhs ?? 0), currency),
                currency,
              )}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm">
              <TrendingUp size={15} />
              <span className="font-semibold">
                {formatCurrency(
                  convertFromGhs(Number(portfolio?.totalReturnsGhs ?? 0), currency),
                  currency,
                )}
              </span>
              <span className="text-white/70">in returns</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative -mt-8 rounded-2xl border border-border bg-card p-4 shadow-soft-lg">
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon, tile, fg }) => (
            <Link
              key={label}
              to={to}
              className="flex flex-col items-center gap-2 transition active:scale-95"
            >
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tile} ${fg}`}>
                <Icon size={20} strokeWidth={2.1} />
              </span>
              <span className="text-center text-[11px] font-semibold leading-tight text-ink-700">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6">
      {user?.kycStatus !== "verified" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            {user?.kycStatus === "pending"
              ? "Verify your identity to unlock investing."
              : "Your KYC needs attention."}
            {user?.kycStatus !== "rejected" && (
              <Link to="/kyc" className="ml-1 font-semibold underline">
                Verify now
              </Link>
            )}
          </div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <UserIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink-900">{user?.fullName}</p>
            <p className="truncate text-xs text-ink-500">{user?.phone}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-400">Country</dt>
            <dd className="font-medium text-ink-900">{countryName}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">Preferred currency</dt>
            <dd className="font-medium text-ink-900">
              {user?.preferredCurrency}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-400">KYC status</dt>
            <dd className="mt-1">
              <Badge
                variant={kycBadgeVariant[user?.kycStatus ?? "pending"]}
                className="capitalize"
              >
                {user?.kycStatus}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">
            Withdrawal methods
          </h2>
          <button
            onClick={openForm}
            className="flex items-center gap-1 text-sm font-semibold text-primary active:scale-95 transition"
          >
            <Plus size={15} />
            Add
          </button>
        </div>

        {methodsLoading ? (
          <Skeleton className="h-16" />
        ) : methods.length === 0 ? (
          <p className="text-sm text-ink-400">No withdrawal methods yet.</p>
        ) : (
          <div className="space-y-2">
            {methods.map((m) => {
              const Icon = methodIcon[m.type];
              return (
                <Card key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-500">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {m.accountName}
                        {m.isDefault && (
                          <Badge className="ml-2 text-[10px]">Default</Badge>
                        )}
                      </p>
                      <p className="text-xs text-ink-400">
                        {m.type === "crypto" ? m.cryptoAddress : m.accountNumber}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                    aria-label="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </div>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent title="Add withdrawal method">
          <form onSubmit={handleAddMethod} className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => handleTypeChange(v as typeof form.type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isGhana && <SelectItem value="momo">Mobile Money</SelectItem>}
                  {isGhana && <SelectItem value="bank">Bank Transfer</SelectItem>}
                  <SelectItem value="crypto">USDT (Crypto)</SelectItem>
                </SelectContent>
              </Select>
              {!isGhana && (
                <p className="mt-1.5 text-xs text-ink-400">
                  Mobile Money and Bank Transfer are only available to
                  Ghanaian clients — USDT (TRC20) works everywhere.
                </p>
              )}
            </div>

            {form.type === "momo" && (
              <div>
                <Label>Network</Label>
                <Select
                  value={form.network}
                  onValueChange={(v) => setForm({ ...form, network: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN</SelectItem>
                    <SelectItem value="vodafone">Vodafone Cash</SelectItem>
                    <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === "bank" && (
              <div>
                <Label>Bank</Label>
                <Select
                  value={form.network}
                  onValueChange={(v) => setForm({ ...form, network: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(form.type === "momo" || form.type === "bank") && (
              <>
                <div>
                  <Label htmlFor="accountNumber">
                    {form.type === "momo" ? "Phone number" : "Account number"}
                  </Label>
                  <Input
                    id="accountNumber"
                    required
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm({ ...form, accountNumber: e.target.value })
                    }
                    placeholder={
                      form.type === "momo" ? "0240000000" : "1234567890123"
                    }
                    trailing={
                      verifying ? (
                        <Loader2 size={16} className="animate-spin text-ink-400" />
                      ) : undefined
                    }
                  />
                  {verifyError && (
                    <p className="mt-1.5 text-xs text-red-600">{verifyError}</p>
                  )}
                </div>

                <div>
                  <Label>Account name</Label>
                  <Input
                    readOnly
                    required
                    value={form.accountName}
                    placeholder={
                      form.type === "momo"
                        ? "Waiting for phone number…"
                        : "Waiting for account number…"
                    }
                    className={`cursor-not-allowed text-ink-600 ${
                      nameVerified ? "border-primary/40" : ""
                    }`}
                    trailing={
                      nameVerified ? (
                        <CheckCircle2 size={18} className="text-primary" />
                      ) : undefined
                    }
                  />
                  {nameVerified ? (
                    <p className="mt-1.5 text-xs font-medium text-primary">
                      Verified — this is the exact name on the account.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-ink-400">
                      Auto-filled once verified — cannot be edited manually.
                    </p>
                  )}
                </div>
              </>
            )}

            {form.type === "crypto" && (
              <>
                <div>
                  <Label htmlFor="walletName">Wallet name</Label>
                  <Input
                    id="walletName"
                    required
                    value={form.accountName}
                    onChange={(e) =>
                      setForm({ ...form, accountName: e.target.value })
                    }
                    placeholder="Ama Owusu"
                  />
                </div>
                <div>
                  <Label htmlFor="cryptoAddress">USDT address (TRC20)</Label>
                  <Input
                    id="cryptoAddress"
                    required
                    value={form.cryptoAddress}
                    onChange={(e) =>
                      setForm({ ...form, cryptoAddress: e.target.value })
                    }
                    placeholder="T..."
                  />
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-primary focus:ring-primary"
              />
              Set as default
            </label>

            <Button type="submit" size="lg" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save method"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
