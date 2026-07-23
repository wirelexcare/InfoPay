import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Coins,
  Gem,
  LineChart,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "../components/ui/card";

const ACTIVITIES = [
  { icon: LineChart, label: "Forex trading" },
  { icon: Coins, label: "Cryptocurrency" },
  { icon: Building2, label: "Real estate" },
  { icon: Gem, label: "Jewelry trade" },
];

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-5 py-2 animate-in fade-in-0 duration-300">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900 active:scale-95"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-sky-600 p-6 text-white shadow-soft-lg">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
          <ShieldCheck size={24} />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          About InfoPay
        </h1>
        <p className="mt-1 text-sm text-white/70">
          A real investment platform, not a game of chance.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400">
          Who we are
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          InfoPay is a team that pools members' funds and puts them to work in
          real, income-generating markets. Real operations run by real people,
          not paper promises.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ACTIVITIES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5"
            >
              <Icon size={16} className="text-primary" />
              <span className="text-xs font-semibold text-ink-700">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-ink-900">What we offer you</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
          <li>• Packages for every budget, from entry-level to premium.</li>
          <li>• A fixed return over a set number of days.</li>
          <li>
            • Daily payouts credited to your wallet, so you watch your money grow
            and withdraw as you earn.
          </li>
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-ink-900">How we use your money</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
          <li>• Your capital is deployed across a diversified mix of markets.</li>
          <li>• The profits from those activities are what fund your returns.</li>
          <li>
            • Spreading funds across several markets means no single bad day
            decides your outcome.
          </li>
        </ul>
      </Card>

      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-ink-900">Our safety net</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
          <li>• Markets move, some days in our favour and some against us.</li>
          <li>
            • We keep a dedicated reserve fund for the days a market turns
            against us.
          </li>
          <li>
            • The reserve cushions the impact so your daily payouts stay steady
            through the rough patches.
          </li>
          <li>• We carry the risk so you do not have to.</li>
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink-900">
          Why we are not a Ponzi scheme
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
          <li>• We do not pay old members with new members' deposits.</li>
          <li>• Your returns come from genuine trading and asset activity.</li>
          <li>
            • Real operations back our books, and your withdrawals are yours to
            make.
          </li>
          <li>• Transparency is the whole point.</li>
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink-900">
          An honest word before you start
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          If you want a "double your money overnight" or get-rich-tomorrow
          scheme, InfoPay is not that, and we would rather you look elsewhere.
          But if you want steady, disciplined, real-world growth from a team that
          treats your money seriously, you are in the right place.
        </p>
        <p className="mt-3 text-sm font-semibold text-primary">Welcome aboard.</p>
      </Card>
    </div>
  );
}
