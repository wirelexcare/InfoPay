import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Coins, TrendingUp } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/investments/${id}`)
      .then(({ data }) => {
        setInvestment(data.investment);
        setProject(data.project);
        setTotalEarnedGhs(data.totalEarnedGhs);
      })
      .finally(() => setLoading(false));
  }, [id]);

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

      <p className="text-xs leading-relaxed text-ink-400">
        Daily return is an estimate based on the package's target return
        spread evenly across its duration — it is not a guaranteed payout.
        "Earned so far" reflects only returns actually paid out to your
        wallet.
      </p>
    </div>
  );
}
