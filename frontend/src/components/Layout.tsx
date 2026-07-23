import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Building2, Gift, Headphones, LayoutDashboard, LogOut, PieChart, Settings } from "lucide-react";
import { useAuthStore } from "../lib/store";
import { api } from "../lib/api";
import { AnnouncementOverlay } from "./AnnouncementOverlay";

const TABS = [
  { to: "/packages", label: "Packages", icon: Building2 },
  { to: "/referrals", label: "Refer", icon: Gift },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
];

// Pages that render a full-bleed blue hero behind the header — the header
// goes transparent and switches to white content on these.
const HERO_ROUTES = new Set(["/dashboard", "/login", "/signup"]);

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onHero = HERO_ROUTES.has(pathname);

  // Show the support entry point only when at least one channel is configured.
  const [hasSupport, setHasSupport] = useState(false);
  useEffect(() => {
    api
      .get("/api/support")
      .then(({ data }) => {
        setHasSupport(
          !!(
            data.whatsappChannelUrl ||
            data.telegramGroupUrl ||
            (data.telegramProfiles?.length ?? 0) > 0
          ),
        );
      })
      .catch(() => setHasSupport(false));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const iconBtn = onHero
    ? "border-white/25 text-white hover:bg-white/15"
    : "border-border text-ink-500 hover:border-primary/20 hover:bg-primary/10 hover:text-primary";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header
        className={`safe-top fixed inset-x-0 top-0 z-30 transition-colors ${
          onHero
            ? "bg-primary"
            : "border-b border-border/70 bg-background/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex w-full max-w-sm items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 active:scale-95 transition">
            <img src="/icon-192.png" alt="InfoPay" className="h-8 w-8 object-contain" />
            <span
              className={`text-base font-bold tracking-tight ${
                onHero ? "text-white" : "text-ink-900"
              }`}
            >
              InfoPay
            </span>
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              {hasSupport && (
                <Link
                  to="/support"
                  className={`grid h-9 w-9 place-items-center rounded-full border transition active:scale-95 ${iconBtn}`}
                  aria-label="Support"
                  title="Support"
                >
                  <Headphones size={16} />
                </Link>
              )}
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className={`grid h-9 w-9 place-items-center rounded-full border transition active:scale-95 ${iconBtn}`}
                  aria-label="Admin panel"
                  title="Admin Panel"
                >
                  <Settings size={16} />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className={`grid h-9 w-9 place-items-center rounded-full border transition active:scale-95 ${iconBtn}`}
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  onHero ? "text-white/90 hover:text-white" : "text-ink-600 hover:text-ink-900"
                }`}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95 ${
                  onHero
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-ink-900 text-white hover:bg-ink-800"
                }`}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full max-w-sm px-4 pt-16 sm:px-6 ${user ? "pb-28" : "pb-8"}`}>
        <Outlet />
      </main>

      <AnnouncementOverlay />

      {user && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 px-4 pb-3">
          <div className="mx-auto flex w-full max-w-sm items-center justify-around gap-1 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-soft-lg backdrop-blur-md">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition active:scale-95 ${
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
    </div>
  );
}
