import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";

interface Project {
  id: string;
  title: string;
  location: string;
  minInvestmentGhs: string;
  expectedReturnPct: string;
  durationMonths: string;
  imageUrl: string | null;
  fundingStatus: "open" | "target_reached" | "stopped";
}

function minDailyRoi(p: Project): number {
  const totalReturn = Number(p.minInvestmentGhs) * (Number(p.expectedReturnPct) / 100);
  const durationDays = Number(p.durationMonths) * 30;
  if (durationDays <= 0) return 0;
  return Math.round((totalReturn / durationDays) * 100) / 100;
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

export function PackagesPage() {
  const [packages, setPackages] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/projects")
      .then(({ data }) => setPackages(data.projects))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Investment Packages
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Choose from our investment packages and start earning daily returns.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-ink-200 py-14 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-400">
            <Building2 size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-700">
              No investment packages available yet
            </p>
            <p className="text-xs text-ink-400">Check back soon.</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {packages.map((p) => (
          <Link key={p.id} to={`/packages/${p.id}`} className="block active:scale-[0.99] transition">
            <Card className="overflow-hidden transition hover:border-primary/30">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="grid h-28 w-full place-items-center bg-gradient-to-br from-accent to-ink-50 text-brand-300">
                  <Building2 size={32} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-ink-900">{p.title}</p>
                  <Badge className="shrink-0">
                    <TrendingUp size={12} />
                    {Number(p.expectedReturnPct)}%
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                  <MapPin size={12} />
                  {p.location}
                </p>
                <span
                  className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[p.fundingStatus]}`}
                >
                  {STATUS_LABEL[p.fundingStatus]}
                </span>
                <p className="mt-2 text-xs font-medium text-ink-600">
                  Min ₵{Number(p.minInvestmentGhs).toLocaleString()} · Profit ₵
                  {minDailyRoi(p).toLocaleString()}/day
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
