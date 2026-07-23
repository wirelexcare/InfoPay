import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { api } from "../lib/api";
import {
  BarChart3,
  Users,
  Building2,
  DollarSign,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Scale,
  Gift,
  Smartphone,
  Trophy,
  Megaphone,
} from "lucide-react";

interface DashboardData {
  aum: string;
  totalDeposits: string;
  totalPayouts: string;
  totalWithdrawals: string;
  dailyPayoutsCount: number;
  dailyPayoutsAmount: string;
}

export function AdminPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/packages");
      return;
    }

    const fetchDashboard = async () => {
      try {
        const res = await api.get("/api/admin/financials/dashboard");
        setDashboard(res.data);
      } catch (error) {
        console.error("Failed to fetch admin dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const cards = [
    {
      title: "AUM",
      value: dashboard?.aum,
      icon: DollarSign,
      onClick: () => navigate("/admin/financials"),
    },
    {
      title: "Total Deposits",
      value: dashboard?.totalDeposits,
      icon: CreditCard,
      onClick: () => navigate("/admin/payments"),
    },
    {
      title: "Total Payouts",
      value: dashboard?.totalPayouts,
      icon: DollarSign,
      onClick: () => navigate("/admin/withdrawals"),
    },
    {
      title: "Total Withdrawals (Completed)",
      value: dashboard?.totalWithdrawals,
      icon: CreditCard,
      onClick: () => navigate("/admin/withdrawals"),
    },
    {
      title: "Today's Payouts",
      value: `${dashboard?.dailyPayoutsCount || 0} txns`,
      icon: BarChart3,
      onClick: () => navigate("/admin/withdrawals"),
    },
  ];

  const navItems = [
    { label: "Dashboard", icon: BarChart3, to: "/admin" },
    { label: "Users", icon: Users, to: "/admin/users" },
    { label: "KYC", icon: Users, to: "/admin/kyc" },
    { label: "Packages", icon: Building2, to: "/admin/packages" },
    { label: "Financials", icon: DollarSign, to: "/admin/financials" },
    { label: "Payments", icon: CreditCard, to: "/admin/payments" },
    { label: "Withdrawals", icon: CreditCard, to: "/admin/withdrawals" },
    { label: "ROI Reconciliation", icon: Scale, to: "/admin/roi" },
    { label: "Referral Program", icon: Gift, to: "/admin/referrals" },
    { label: "Mobile Money Deposits", icon: Smartphone, to: "/admin/deposits" },
    { label: "Reward Pools", icon: Trophy, to: "/admin/rewards" },
    { label: "Announcements", icon: Megaphone, to: "/admin/announcements" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <h1 className="text-lg font-bold sm:text-xl">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">Investor view</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile: horizontal scrolling nav */}
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
          {navItems.map((item) => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink-600 transition hover:border-primary/30 hover:text-primary"
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex">
        {/* Desktop: vertical sidebar */}
        <nav className="hidden w-64 shrink-0 border-r border-border bg-card/30 lg:block">
          <div className="sticky top-[61px] space-y-2 p-4">
            {navItems.map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-ink-600 transition hover:bg-primary/10 hover:text-primary"
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-6 text-xl font-bold sm:text-2xl">Financial Overview</h2>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-ink-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      onClick={card.onClick}
                      className="p-6 rounded-lg border border-border bg-card transition hover:shadow-soft hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink-500">
                            {card.title}
                          </p>
                          <p className="text-2xl font-bold text-ink-900 mt-2">
                            {card.value ? `₵${parseFloat(card.value || "0").toFixed(2)}` : "—"}
                          </p>
                        </div>
                        <Icon size={24} className="text-primary/50" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-12 p-6 rounded-lg border border-border bg-card">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => navigate("/admin/kyc")}
                  className="p-4 rounded-lg bg-primary/10 text-primary font-medium transition hover:bg-primary/20"
                >
                  Review Pending KYC
                </button>
                <button
                  onClick={() => navigate("/admin/withdrawals")}
                  className="p-4 rounded-lg bg-amber-50 text-amber-700 font-medium transition hover:bg-amber-100"
                >
                  Process Pending Withdrawals
                </button>
                <button
                  onClick={() => navigate("/admin/users")}
                  className="p-4 rounded-lg bg-blue-50 text-blue-700 font-medium transition hover:bg-blue-100"
                >
                  View All Users
                </button>
                <button
                  onClick={() => navigate("/admin/packages")}
                  className="p-4 rounded-lg bg-green-50 text-green-700 font-medium transition hover:bg-green-100"
                >
                  Manage Packages
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
