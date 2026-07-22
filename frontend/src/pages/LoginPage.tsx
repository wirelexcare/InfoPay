import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Lock, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { phone, password });
      setSession(data);
      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-6">
      <div className="-mx-4 -mt-16 rounded-b-[2rem] bg-gradient-to-br from-primary to-sky-600 px-4 pb-12 pt-24 text-center sm:-mx-6 sm:px-6">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-white">
          <ShieldCheck size={26} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Log in to keep growing your portfolio.
        </p>
      </div>

      <div className="relative -mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              icon={<Phone size={18} />}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 5X XXX XXXX"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              icon={<Lock size={18} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Logging in…" : "Log in"}
            {!loading && <ArrowRight size={16} />}
          </Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-400">
          <ShieldCheck size={13} />
          Your details are encrypted and never shared
        </p>
      </div>

      <p className="mt-5 text-center text-sm text-ink-500">
        No account?{" "}
        <Link to="/signup" className="font-semibold text-primary">
          Sign up
        </Link>
      </p>
    </div>
  );
}
