import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package as PackageIcon } from "lucide-react";
import { api } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { tierStyle, tierTextClasses } from "../lib/tierTheme";

interface Package {
  id: string;
  title: string;
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

export function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
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
          Packages
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Pick a tier and start earning daily returns.
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && packages.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-200 py-14 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-100 text-ink-400">
            <PackageIcon size={22} />
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
        {packages.map((p) => {
          const { gradient } = tierStyle(p.title);
          const { main: textMain, muted: textMuted, divider, pill } = tierTextClasses(
            tierStyle(p.title),
          );

          return (
            <Link
              key={p.id}
              to={`/packages/${p.id}`}
              className={`block overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-soft-lg transition active:scale-[0.98] ${gradient}`}
            >
              <div className="flex items-start justify-between">
                <p className={`text-xs font-bold uppercase tracking-[0.15em] ${textMuted}`}>
                  {p.title}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill} ${textMain}`}>
                  {Number(p.durationDays)} days
                </span>
              </div>

              <p className={`mt-3 text-3xl font-extrabold tracking-tight ${textMain}`}>
                ₵{Number(p.amountGhs).toLocaleString()}
              </p>
              <p className={`text-xs font-medium ${textMuted}`}>invested</p>

              <div className={`mt-4 flex items-center justify-between border-t pt-3 ${divider}`}>
                <div>
                  <p className={`text-lg font-bold ${textMain}`}>
                    {Number(p.expectedReturnPct)}%
                  </p>
                  <p className={`text-[11px] ${textMuted}`}>total return</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${textMain}`}>
                    ₵{dailyRoi(p).toLocaleString()}
                  </p>
                  <p className={`text-[11px] ${textMuted}`}>per day</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
