import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Coins, Gift, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { tierStyle, tierTextClasses } from "../lib/tierTheme";

interface Investment {
  id: string;
  projectId: string;
  amountGhs: string;
  status: string;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  expectedReturnPct: string;
  durationDays: string;
  imageUrl: string | null;
}

interface ClaimablePayout {
  id: string;
  amountGhs: string;
  scheduledFor: string;
}

interface RoiEntry {
  id: string;
  amountGhs: string;
  status: "scheduled" | "paid" | "failed" | "forfeited";
  scheduledFor: string;
  paidAt: string | null;
}

const ROI_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  forfeited: "bg-red-100 text-red-600",
  failed: "bg-red-100 text-red-600",
};

const ROI_STATUS_LABELS: Record<string, string> = {
  scheduled: "Ready to claim",
  paid: "Claimed",
  forfeited: "Forfeited",
  failed: "Failed",
};

const statusVariant: Record<string, "default" | "muted" | "destructive"> = {
  pending: "default",
  active: "default",
  completed: "muted",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  pending: "In Progress",
  active: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function InvestmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useAuthStore((s) => s.user?.preferredCurrency) ?? "GHS";

  const [investment, setInvestment] = useState<Investment | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [totalEarnedGhs, setTotalEarnedGhs] = useState("0");
  const [claimable, setClaimable] = useState<ClaimablePayout | null>(null);
  const [roiHistory, setRoiHistory] = useState<RoiEntry[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    return api.get(`/api/investments/${id}`).then(({ data }) => {
      setInvestment(data.investment);
      setProject(data.project);
      setTotalEarnedGhs(data.totalEarnedGhs);
      setClaimable(data.claimablePayout ?? null);
      setRoiHistory(data.roiHistory ?? []);
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleClaim() {
    if (!claimable) return;
    setClaiming(true);
    try {
      const { data } = await api.post(`/api/investments/${id}/claim-roi`);
      toast.success(`Claimed ₵${data.claimedGhs}! Added to your available balance.`);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to claim ROI");
      // Refresh so an expired/already-claimed payout disappears
      await load().catch(() => {});
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!investment || !project) {
    return <p className="text-sm text-ink-500">Investment not found.</p>;
  }

  const amount = Number(investment.amountGhs);
  const durationDays = Number(project.durationDays);
  const estimatedTotalReturn = amount * (Number(project.expectedReturnPct) / 100);
  const estimatedDailyReturn =
    durationDays > 0 ? estimatedTotalReturn / durationDays : 0;

  const startDate = new Date(investment.createdAt);
  const maturityDate = addDays(startDate, durationDays);

  const { gradient } = tierStyle(project.title);
  const { main: textMain, muted: textMuted, divider } = tierTextClasses(
    tierStyle(project.title),
  );

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900 active:scale-95"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className={`overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-soft-lg ${gradient}`}>
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/packages/${project.id}`}
            className={`text-xs font-bold uppercase tracking-[0.15em] ${textMuted} hover:underline`}
          >
            {project.title}
          </Link>
          <Badge variant={statusVariant[investment.status] ?? "muted"} className="shrink-0">
            {statusLabels[investment.status] ?? investment.status}
          </Badge>
        </div>

        <p className={`mt-3 text-3xl font-extrabold tracking-tight ${textMain}`}>
          {formatCurrency(convertFromGhs(amount, currency), currency)}
        </p>
        <p className={`text-xs font-medium ${textMuted}`}>amount invested</p>

        <p className={`mt-4 border-t pt-3 text-xs ${divider} ${textMuted}`}>
          Invested on {startDate.toLocaleDateString()}
        </p>
      </div>

      {claimable && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Gift size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Today's ROI
                </p>
                <p className="text-xl font-extrabold tracking-tight text-ink-900">
                  {formatCurrency(
                    convertFromGhs(Number(claimable.amountGhs), currency),
                    currency,
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition active:scale-95 disabled:opacity-50"
            >
              {claiming && <Loader2 size={14} className="animate-spin" />}
              {claiming ? "Claiming..." : "Claim"}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            Claim today's return to add it to your available balance. Unclaimed
            returns expire when the next day begins.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <TrendingUp size={16} className="text-primary" />
          <p className="mt-2 text-lg font-bold text-ink-900">
            {formatCurrency(
              convertFromGhs(estimatedDailyReturn, currency),
              currency,
            )}
          </p>
          <p className="text-xs text-ink-400">Estimated daily return</p>
        </Card>
        <Card className="p-4">
          <Coins size={16} className="text-primary" />
          <p className="mt-2 text-lg font-bold text-ink-900">
            {formatCurrency(
              convertFromGhs(Number(totalEarnedGhs), currency),
              currency,
            )}
          </p>
          <p className="text-xs text-ink-400">Earned so far</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <Calendar size={16} className="text-primary" />
          Timeline
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-ink-400">Started</p>
            <p className="font-medium text-ink-900">
              {startDate.toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Expected maturity</p>
            <p className="font-medium text-ink-900">
              {maturityDate.toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Duration</p>
            <p className="font-medium text-ink-900">{durationDays} days</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Target total return</p>
            <p className="font-medium text-ink-900">
              {Number(project.expectedReturnPct)}%
            </p>
          </div>
        </div>
      </Card>

      {roiHistory.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <Coins size={16} className="text-primary" />
            ROI log
          </div>
          <div className="mt-2 divide-y divide-border/60">
            {roiHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {formatCurrency(
                      convertFromGhs(Number(entry.amountGhs), currency),
                      currency,
                    )}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {new Date(entry.scheduledFor).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROI_STATUS_STYLES[entry.status] ?? "bg-ink-100 text-ink-600"}`}
                >
                  {ROI_STATUS_LABELS[entry.status] ?? entry.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-ink-400">
        Daily return is an estimate based on the package's target return
        spread evenly across its duration. Each day's return must be claimed
        from this page to be added to your available balance; unclaimed
        returns are forfeited when the next day begins. "Earned so far"
        reflects only returns you have claimed.
      </p>
    </div>
  );
}
