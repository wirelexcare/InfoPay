import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, Gift, LayoutDashboard, LogOut, PieChart, Wallet, Settings } from "lucide-react";
import { useAuthStore } from "../lib/store";
import { Toaster } from "./ui/sonner";

const TABS = [
  { to: "/packages", label: "Investment Packages", icon: Building2 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="safe-top sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-sm items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/packages" className="flex items-center gap-2 active:scale-95 transition">
            <img src="/icon-192.png" alt="InfoPay" className="h-8 w-8 object-contain" />
            <span className="text-base font-bold tracking-tight text-ink-900">
              InfoPay
            </span>
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/referrals"
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-500 transition active:scale-95 hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
                aria-label="Refer and earn"
                title="Refer & Earn"
              >
                <Gift size={16} />
              </Link>
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-500 transition active:scale-95 hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
                  aria-label="Admin panel"
                  title="Admin Panel"
                >
                  <Settings size={16} />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-500 transition active:scale-95 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white transition active:scale-95 hover:bg-ink-800"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full max-w-sm px-4 py-5 sm:px-6 ${user ? "pb-28" : "pb-5"}`}>
        <Outlet />
      </main>

      {user && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 px-4 pb-3">
          <div className="mx-auto flex w-full max-w-sm items-center justify-around gap-1 rounded-[1.75rem] border border-border/70 bg-card/90 p-1.5 shadow-soft-lg backdrop-blur-md">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-semibold transition active:scale-95 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-ink-400 hover:text-ink-600"
                  }`
                }
              >
                <Icon size={19} strokeWidth={2.25} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <Toaster />
    </div>
  );
}
