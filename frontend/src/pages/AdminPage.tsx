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
  Headphones,
  MessageSquare,
  Menu,
  X,
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Unread live-chat messages badge on the header icon
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    if (user?.role !== "admin") return;
    let cancelled = false;
    async function fetchUnread() {
      if (document.visibilityState === "hidden") return;
      try {
        const { data } = await api.get("/api/admin/chats/unread");
        if (!cancelled) setChatUnread(data.count ?? 0);
      } catch {
        // ignore; badge just stays stale
      }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

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
    { label: "Support Links", icon: Headphones, to: "/admin/support" },
    { label: "Live Chats", icon: MessageSquare, to: "/admin/chats" },
  ];

  // Most-used destinations, surfaced as quick tiles on small screens
  const quickNav = [
    {
      label: "Live Chats",
      icon: MessageSquare,
      to: "/admin/chats",
      tile: "bg-sky-100",
      fg: "text-sky-600",
    },
    {
      label: "Reward Pools",
      icon: Trophy,
      to: "/admin/rewards",
      tile: "bg-indigo-100",
      fg: "text-indigo-600",
    },
    {
      label: "MoMo Deposits",
      icon: Smartphone,
      to: "/admin/deposits",
      tile: "bg-emerald-100",
      fg: "text-emerald-600",
    },
    {
      label: "Users",
      icon: Users,
      to: "/admin/users",
      tile: "bg-amber-100",
      fg: "text-amber-600",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-ink-600 transition hover:bg-ink-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-lg font-bold sm:text-xl">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/admin/chats")}
              className="relative flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
              aria-label="Live chats"
              title="Live Chats"
            >
              <Headphones size={16} />
              <span className="hidden sm:inline">Live Chats</span>
              {chatUnread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
            </button>
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

      </header>

      {/* Mobile: slide-in side menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-soft-lg animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <p className="text-sm font-bold text-ink-900">Admin Menu</p>
              <button
                onClick={() => setMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(item.to);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-primary/10 hover:text-primary"
                >
                  <item.icon size={18} />
                  {item.label}
                  {item.to === "/admin/chats" && chatUnread > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                      {chatUnread > 99 ? "99+" : chatUnread}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

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
            {/* Mobile: quick access to the most-used admin pages */}
            <div className="mb-6 grid grid-cols-4 gap-2 lg:hidden">
              {quickNav.map(({ label, icon: Icon, to, tile, fg }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-1 py-3 transition active:scale-95 hover:border-primary/30"
                >
                  <span
                    className={`relative grid h-11 w-11 place-items-center rounded-2xl ${tile} ${fg}`}
                  >
                    <Icon size={19} strokeWidth={2.1} />
                    {to === "/admin/chats" && chatUnread > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {chatUnread > 99 ? "99+" : chatUnread}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[10px] font-semibold leading-tight text-ink-700">
                    {label}
                  </span>
                </button>
              ))}
            </div>

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
