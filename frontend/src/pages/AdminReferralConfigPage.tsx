import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Pagination } from "../components/ui/pagination";

interface ConfigRow {
  level: number;
  rewardPercentage: string;
  isActive: boolean;
  updatedAt: string;
  updatedByEmail: string | null;
}

interface RewardRow {
  id: string;
  level: number;
  investmentAmountGhs: string;
  rewardPercentage: string;
  rewardAmountGhs: string;
  status: string;
  createdAt: string;
  referrerEmail: string;
  refereeEmail: string;
}

export function AdminReferralConfigPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ConfigRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [totalRewarded, setTotalRewarded] = useState("0.00");
  const [loading, setLoading] = useState(true);
  const [rewardsSearch, setRewardsSearch] = useState("");
  const [rewardsPage, setRewardsPage] = useState(1);
  const [rewardsTotal, setRewardsTotal] = useState(0);
  const rewardsLimit = 50;

  const fetchConfig = async () => {
    const configRes = await api.get("/api/admin/referral-config");
    setConfig(configRes.data.data);
    setDrafts(
      Object.fromEntries(
        configRes.data.data.map((c: ConfigRow) => [c.level, c.rewardPercentage]),
      ),
    );
  };

  const fetchRewards = async (p: number, search: string) => {
    const params = new URLSearchParams({
      page: p.toString(),
      ...(search && { search }),
    });
    const rewardsRes = await api.get(`/api/admin/referral-rewards?${params}`);
    setRewards(rewardsRes.data.data);
    setTotalRewarded(rewardsRes.data.totalRewardedGhs);
    setRewardsTotal(rewardsRes.data.total);
    setRewardsPage(p);
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchRewards(1, rewardsSearch)]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load referral configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!loading) fetchRewards(1, rewardsSearch);
  }, [rewardsSearch]);

  async function handleSave(level: number) {
    try {
      setSaving(level);
      await api.post("/api/admin/referral-config", {
        level,
        rewardPercentage: drafts[level],
      });
      toast.success(`Level ${level} reward updated`);
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to update reward percentage");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-8 w-40 bg-ink-100 rounded animate-pulse" />
          <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/admin")}
          className="mb-6 flex items-center gap-2 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Referral Program</h1>
          <div className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            ₵{totalRewarded} rewarded total
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Reward Percentages
          </h2>
          <p className="text-sm text-ink-500 mb-4">
            The percentage of a referee's investment credited to their
            referrer, per level of the referral chain.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((level) => {
              const row = config.find((c) => c.level === level);
              return (
                <div key={level} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold text-ink-900 mb-2">
                    Level {level}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={drafts[level] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [level]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2"
                    />
                    <span className="text-sm text-ink-500">%</span>
                  </div>
                  <button
                    onClick={() => handleSave(level)}
                    disabled={saving === level}
                    className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {saving === level ? "Saving..." : "Save"}
                  </button>
                  {row?.updatedByEmail && (
                    <p className="mt-2 text-xs text-ink-400">
                      Last set by {row.updatedByEmail} ·{" "}
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-ink-700 uppercase mb-4">
            Recent Rewards ({rewardsTotal})
          </h2>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <input
              type="text"
              placeholder="Search by referrer or referee email..."
              value={rewardsSearch}
              onChange={(e) => setRewardsSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>
          {rewards.length === 0 ? (
            <p className="text-sm text-ink-600">No referral rewards yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Referrer
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Referee
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Level
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Investment
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Reward
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-ink-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-sm text-ink-700">
                        {r.referrerEmail}
                      </td>
                      <td className="px-3 py-2 text-sm text-ink-700">
                        {r.refereeEmail}
                      </td>
                      <td className="px-3 py-2 text-sm text-ink-700">L{r.level}</td>
                      <td className="px-3 py-2 text-sm text-ink-700">
                        ₵{parseFloat(r.investmentAmountGhs).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-ink-900">
                        ₵{parseFloat(r.rewardAmountGhs).toFixed(2)} ({r.rewardPercentage}%)
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-500">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rewards.length > 0 && (
            <Pagination
              page={rewardsPage}
              limit={rewardsLimit}
              total={rewardsTotal}
              itemCount={rewards.length}
              onPageChange={(p) => fetchRewards(p, rewardsSearch)}
              itemLabel="rewards"
            />
          )}
        </div>
      </div>
    </div>
  );
}
