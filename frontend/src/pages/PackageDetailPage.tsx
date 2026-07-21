import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Calendar, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";

interface Project {
  id: string;
  title: string;
  description: string;
  location: string;
  minInvestmentGhs: string;
  maxInvestmentGhs: string | null;
  expectedReturnPct: string;
  durationMonths: string;
  imageUrl: string | null;
  fundingStatus: "open" | "target_reached" | "stopped";
}

const STATUS_LABEL: Record<Project["fundingStatus"], string> = {
  open: "Open for investment",
  target_reached: "Fully funded",
  stopped: "Closed",
};

const STATUS_COLOR: Record<Project["fundingStatus"], string> = {
  open: "bg-green-50 text-green-700",
  target_reached: "bg-blue-50 text-blue-700",
  stopped: "bg-ink-100 text-ink-500",
};

function minDailyRoi(p: Project): number {
  const totalReturn = Number(p.minInvestmentGhs) * (Number(p.expectedReturnPct) / 100);
  const durationDays = Number(p.durationMonths) * 30;
  if (durationDays <= 0) return 0;
  return Math.round((totalReturn / durationDays) * 100) / 100;
}

export function PackageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [project, setProject] = useState<Project | null>(null);
  const [amount, setAmount] = useState("");
  const [investing, setInvesting] = useState(false);
  const currency = user?.preferredCurrency ?? "GHS";

  useEffect(() => {
    api.get(`/api/projects/${id}`).then(({ data }) => setProject(data.project));
  }, [id]);

  async function handleInvest() {
    if (!user) {
      navigate("/login");
      return;
    }
    setInvesting(true);
    try {
      await api.post("/api/investments", {
        projectId: id,
        amountGhs: amount,
      });
      toast.success("Investment confirmed");
      navigate("/portfolio");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Investment failed");
    } finally {
      setInvesting(false);
    }
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-6 w-2/3 rounded-lg" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
    );
  }

  const isOpen = project.fundingStatus === "open";

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900 active:scale-95"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {project.imageUrl ? (
        <img
          src={project.imageUrl}
          alt={project.title}
          className="h-40 w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="grid h-32 w-full place-items-center rounded-3xl bg-gradient-to-br from-accent to-ink-50 text-brand-300">
          <Building2 size={36} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
            {project.title}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[project.fundingStatus]}`}
          >
            {STATUS_LABEL[project.fundingStatus]}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">{project.location}</p>
      </div>

      <p className="text-sm leading-relaxed text-ink-600">
        {project.description}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <Coins size={16} className="mx-auto text-primary" />
          <p className="mt-1.5 text-xs font-semibold text-ink-900">
            {formatCurrency(
              convertFromGhs(Number(project.minInvestmentGhs), currency),
              currency,
            )}
          </p>
          <p className="text-[10px] text-ink-400">Minimum</p>
        </Card>
        {project.maxInvestmentGhs && (
          <Card className="p-3 text-center">
            <Coins size={16} className="mx-auto text-primary" />
            <p className="mt-1.5 text-xs font-semibold text-ink-900">
              {formatCurrency(
                convertFromGhs(Number(project.maxInvestmentGhs), currency),
                currency,
              )}
            </p>
            <p className="text-[10px] text-ink-400">Maximum</p>
          </Card>
        )}
        <Card className="p-3 text-center">
          <TrendingUp size={16} className="mx-auto text-primary" />
          <p className="mt-1.5 text-xs font-semibold text-ink-900">
            {Number(project.expectedReturnPct)}%
          </p>
          <p className="text-[10px] text-ink-400">Return</p>
        </Card>
        <Card className="p-3 text-center">
          <Calendar size={16} className="mx-auto text-primary" />
          <p className="mt-1.5 text-xs font-semibold text-ink-900">
            {project.durationMonths}mo
          </p>
          <p className="text-[10px] text-ink-400">Duration</p>
        </Card>
        <Card className="p-3 text-center">
          <Coins size={16} className="mx-auto text-primary" />
          <p className="mt-1.5 text-xs font-semibold text-ink-900">
            {formatCurrency(convertFromGhs(minDailyRoi(project), currency), currency)}
          </p>
          <p className="text-[10px] text-ink-400">Min Daily ROI</p>
        </Card>
      </div>

      <Card className="p-4">
        {isOpen ? (
          <>
            <Label htmlFor="amount">Investment amount (GHS)</Label>
            <Input
              id="amount"
              type="number"
              min={project.minInvestmentGhs}
              max={project.maxInvestmentGhs ?? undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={project.minInvestmentGhs}
            />
            <Button
              onClick={handleInvest}
              disabled={investing || !amount}
              variant="brand"
              size="lg"
              className="mt-4 w-full"
            >
              {investing ? "Processing…" : user ? "Invest now" : "Log in to invest"}
            </Button>
            {!user && (
              <p className="mt-2 text-center text-xs text-ink-400">
                <Link to="/login" className="font-semibold text-primary">
                  Log in
                </Link>{" "}
                to complete your investment.
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-sm font-medium text-ink-500">
            {project.fundingStatus === "target_reached"
              ? "This project has reached its funding target and is no longer accepting investments."
              : "This project is no longer accepting investments."}
          </p>
        )}
      </Card>
    </div>
  );
}
