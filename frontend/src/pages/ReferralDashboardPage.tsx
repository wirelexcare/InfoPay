import { useEffect, useState } from "react";
import { Copy, Gift, ShieldAlert, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { convertFromGhs, formatCurrency } from "../lib/currency";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

interface Stats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  level1EarningsGhs: string;
  level2EarningsGhs: string;
  level3EarningsGhs: string;
  totalEarningsGhs: string;
}

interface ConfigRow {
  level: number;
  rewardPercentage: string;
  isActive: boolean;
}

interface Referee {
  userId: string;
  fullName: string;
  phone: string;
  referredAt: string;
  totalInvestedGhs: string | null;
}

interface Reward {
  id: string;
  level: number;
  investmentAmountGhs: string;
  rewardPercentage: string;
  rewardAmountGhs: string;
  createdAt: string;
  refereeFullName: string;
}

export function ReferralDashboardPage() {
  const currency = useAuthStore((s) => s.user?.preferredCurrency) ?? "GHS";
  const [code, setCode] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/referrals/code"),
      api.get("/api/referrals/config"),
      api.get("/api/referrals/stats"),
      api.get("/api/referrals/referees?level=1"),
      api.get("/api/referrals/rewards"),
    ])
      .then(([codeRes, configRes, statsRes, refereesRes, rewardsRes]) => {
        setCode(codeRes.data.code);
        setConfig(configRes.data.data);
        setStats(statsRes.data);
        setReferees(refereesRes.data.data);
        setRewards(rewardsRes.data.data);
      })
      .catch(() => toast.error("Failed to load referral data"))
      .finally(() => setLoading(false));
  }, []);

  const pctForLevel = (level: number) =>
    config.find((c) => c.level === level && c.isActive)?.rewardPercentage ?? "0";

  const shareLink = code ? `${window.location.origin}/signup?ref=${code}` : "";

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  }

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast.success("Referral link copied");
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Refer & Earn
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Earn a reward when people you refer invest — and when their
          referrals invest too, up to 3 levels deep.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-sky-600 p-5 text-white shadow-soft-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-white/70">
          Your referral code
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-widest">{code}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={copyCode}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 py-2.5 text-sm font-semibold transition active:scale-95 hover:bg-white/25"
          >
            <Copy size={15} />
            Copy code
          </button>
          <button
            onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-semibold text-primary transition active:scale-95 hover:bg-white/90"
          >
            <Share2 size={15} />
            Share link
          </button>
        </div>
      </div>

      <Card className="p-4">
        <p className="text-sm font-bold text-ink-900">How rewards work</p>
        <p className="mt-1 text-xs text-ink-500">
          When someone in your referral chain invests, you earn a percentage
          of their investment — credited to your wallet instantly. Deposits
          and withdrawals never trigger a reward, only real investments.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[1, 2, 3].map((level) => (
            <div key={level} className="rounded-xl bg-ink-50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-ink-400">
                Level {level}
              </p>
              <p className="mt-1 text-lg font-extrabold text-primary">
                {pctForLevel(level)}%
              </p>
              <p className="text-[10px] text-ink-400">
                {level === 1
                  ? "people you refer"
                  : level === 2
                    ? "their referrals"
                    : "their referrals' referrals"}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={15} className="text-amber-700" />
          <p className="text-sm font-bold text-amber-900">
            Rules & prohibited activity
          </p>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-amber-800">
          <li>
            • Referring yourself — using your own code, or signing up
            duplicate/fake accounts to farm rewards — is prohibited.
          </li>
          <li>
            • Referred accounts must belong to real, independent
            individuals who pass KYC. Bots, stolen identities, and
            circumvented verification are not allowed.
          </li>
          <li>
            • Coordinating with others to create artificial investment
            activity purely to trigger rewards (wash investing) is
            prohibited.
          </li>
        </ul>
        <p className="mt-2 text-xs font-semibold text-amber-900">
          Consequences: rewards obtained through violations will be
          reversed, pending rewards forfeited, and the account(s) involved
          may be suspended or permanently banned. Serious or repeated abuse
          may result in forfeiture of wallet balance tied to the fraudulent
          activity.
        </p>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          Total earned
        </p>
        <p className="mt-1 text-2xl font-extrabold text-ink-900">
          {formatCurrency(convertFromGhs(Number(stats?.totalEarningsGhs ?? 0), currency), currency)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[1, 2, 3].map((level) => (
            <div key={level} className="rounded-xl bg-ink-50 p-2.5">
              <p className="text-[10px] font-semibold uppercase text-ink-400">
                Level {level}
              </p>
              <p className="mt-1 text-sm font-bold text-ink-900">
                {formatCurrency(
                  convertFromGhs(
                    Number(stats?.[`level${level}EarningsGhs` as keyof Stats] ?? 0),
                    currency,
                  ),
                  currency,
                )}
              </p>
              <p className="text-[10px] text-ink-400">
                {stats?.[`level${level}Count` as keyof Stats]} referrals
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink-900">
          <Users size={15} />
          Your direct referrals ({referees.length})
        </h2>
        {referees.length === 0 ? (
          <p className="text-sm text-ink-400">
            Share your code to start earning rewards.
          </p>
        ) : (
          <div className="space-y-2">
            {referees.map((r) => (
              <Card key={r.userId} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {r.fullName}
                  </p>
                  <p className="truncate text-xs text-ink-400">{r.phone}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-ink-700">
                    {formatCurrency(
                      convertFromGhs(Number(r.totalInvestedGhs ?? 0), currency),
                      currency,
                    )}
                  </p>
                  <p className="text-[10px] text-ink-400">invested</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink-900">
          <Gift size={15} />
          Reward history
        </h2>
        {rewards.length === 0 ? (
          <p className="text-sm text-ink-400">No rewards earned yet.</p>
        ) : (
          <div className="space-y-2">
            {rewards.map((r) => (
              <Card key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    +{formatCurrency(
                      convertFromGhs(Number(r.rewardAmountGhs), currency),
                      currency,
                    )}
                  </p>
                  <p className="text-xs text-ink-400">
                    Level {r.level} · {r.refereeFullName} · {r.rewardPercentage}%
                  </p>
                </div>
                <p className="shrink-0 text-xs text-ink-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
