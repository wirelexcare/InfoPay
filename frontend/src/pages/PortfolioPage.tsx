import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { tierStyle } from "../lib/tierTheme";

interface Investment {
  id: string;
  projectId: string;
  amountGhs: string;
  status: string;
  createdAt: string;
  projectTitle: string;
  projectImageUrl: string | null;
  hasClaimableRoi: boolean;
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

export function PortfolioPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const currency = useAuthStore((s) => s.user?.preferredCurrency) ?? "GHS";

  useEffect(() => {
    api
      .get("/api/investments")
      .then(({ data }) => setInvestments(data.investments))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          My investments
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Track every package you've invested in.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {!loading && investments.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-200 py-14 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-400">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-700">
              No investments yet
            </p>
            <p className="text-xs text-ink-400">
              Browse packages to get started.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {investments.map((inv) => {
          const { gradient } = tierStyle(inv.projectTitle);
          return (
            <Link
              key={inv.id}
              to={`/portfolio/${inv.id}`}
              className="block active:scale-[0.99] transition"
            >
              <Card className="flex items-center gap-3 p-4 transition hover:border-primary/30">
                <div
                  className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${gradient}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink-900">
                    {inv.projectTitle}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {formatCurrency(
                      convertFromGhs(Number(inv.amountGhs), currency),
                      currency,
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {inv.hasClaimableRoi && (
                    <span className="animate-pulse rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                      ROI ready
                    </span>
                  )}
                  <Badge variant={statusVariant[inv.status] ?? "muted"}>
                    {statusLabels[inv.status] ?? inv.status}
                  </Badge>
                  <ChevronRight size={16} className="text-ink-300" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
