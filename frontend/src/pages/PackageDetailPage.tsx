import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { tierStyle, tierTextClasses } from "../lib/tierTheme";

interface Package {
  id: string;
  title: string;
  description: string;
  amountGhs: string;
  expectedReturnPct: string;
  durationDays: string;
  imageUrl: string | null;
}

function dailyRoi(p: Package): number {
  const totalReturn = Number(p.amountGhs) * (Number(p.expectedReturnPct) / 100);
  const durationDays = Number(p.durationDays);
  if (durationDays <= 0) return 0;
  return Math.round((totalReturn / durationDays) * 100) / 100;
}

export function PackageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [pkg, setPkg] = useState<Package | null>(null);
  const [investing, setInvesting] = useState(false);
  const currency = user?.preferredCurrency ?? "GHS";

  useEffect(() => {
    api.get(`/api/projects/${id}`).then(({ data }) => setPkg(data.project));
  }, [id]);

  async function handleInvest() {
    if (!user) {
      navigate("/login");
      return;
    }
    setInvesting(true);
    try {
      await api.post("/api/investments", { projectId: id });
      toast.success("Investment confirmed");
      navigate("/portfolio");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Investment failed");
    } finally {
      setInvesting(false);
    }
  }

  if (!pkg) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const { gradient } = tierStyle(pkg.title);
  const { main: textMain, muted: textMuted, divider, pill } = tierTextClasses(
    tierStyle(pkg.title),
  );
  const amount = formatCurrency(convertFromGhs(Number(pkg.amountGhs), currency), currency);

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900 active:scale-95"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className={`overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-soft-lg ${gradient}`}>
        <div className="flex items-start justify-between">
          <p className={`text-xs font-bold uppercase tracking-[0.15em] ${textMuted}`}>
            {pkg.title}
          </p>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill} ${textMain}`}>
            {Number(pkg.durationDays)} days
          </span>
        </div>

        <p className={`mt-3 text-4xl font-extrabold tracking-tight ${textMain}`}>
          {amount}
        </p>
        <p className={`text-xs font-medium ${textMuted}`}>investment amount</p>

        <div className={`mt-5 flex items-center justify-between border-t pt-4 ${divider}`}>
          <div>
            <p className={`text-xl font-bold ${textMain}`}>
              {Number(pkg.expectedReturnPct)}%
            </p>
            <p className={`text-[11px] ${textMuted}`}>total return</p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${textMain}`}>
              {formatCurrency(convertFromGhs(dailyRoi(pkg), currency), currency)}
            </p>
            <p className={`text-[11px] ${textMuted}`}>per day</p>
          </div>
        </div>
      </div>

      {pkg.description && (
        <p className="text-sm leading-relaxed text-ink-600">{pkg.description}</p>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <Button
          onClick={handleInvest}
          disabled={investing}
          size="lg"
          className="w-full"
        >
          {investing
            ? "Processing…"
            : user
              ? `Invest ${amount}`
              : "Log in to invest"}
        </Button>
        {!user && (
          <p className="mt-2 text-center text-xs text-ink-400">
            <Link to="/login" className="font-semibold text-primary">
              Log in
            </Link>{" "}
            to complete your investment.
          </p>
        )}
      </div>
    </div>
  );
}
