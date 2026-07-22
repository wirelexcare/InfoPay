import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Globe2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "../lib/countries";
import { PHONE_RULES, validatePhoneForCountry } from "../lib/phone";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function KycPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const initialCountry = user?.country ?? "GH";
  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    country: initialCountry,
    province: REGIONS_BY_COUNTRY[initialCountry]?.[0] ?? "",
    whatsappNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const regions = REGIONS_BY_COUNTRY[form.country] ?? [];

  function handleCountryChange(country: string) {
    setForm({ ...form, country, province: REGIONS_BY_COUNTRY[country]?.[0] ?? "" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const phone = validatePhoneForCountry(form.country, form.whatsappNumber);
    if (!phone.valid) {
      toast.error(phone.error ?? "Invalid WhatsApp number");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/kyc", { ...form, whatsappNumber: phone.formatted });
      if (user) setUser({ ...user, kycStatus: "verified" });
      setDone(true);
      toast.success("Identity verified");
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "KYC submission failed");
    } finally {
      setLoading(false);
    }
  }

  const callingCode = PHONE_RULES[form.country]?.callingCode;

  if (done) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground animate-in zoom-in-50 duration-300">
          <CheckCircle2 size={32} />
        </div>
        <p className="mt-4 text-lg font-bold text-ink-900">You're verified</p>
        <p className="mt-1 text-sm text-ink-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-center py-6">
      <div className="mb-8">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white">
          <ShieldCheck size={20} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          Verify your identity
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Just your name, location and WhatsApp number — instantly verified.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            icon={<User size={18} />}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>

        <div>
          <Label>Country</Label>
          <Select value={form.country} onValueChange={handleCountryChange}>
            <SelectTrigger icon={<Globe2 size={18} />}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Province / Region</Label>
          <Select
            value={form.province}
            onValueChange={(v) => setForm({ ...form, province: v })}
            disabled={regions.length === 0}
          >
            <SelectTrigger icon={<MapPin size={18} />}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="whatsapp">WhatsApp number</Label>
          <Input
            id="whatsapp"
            type="tel"
            required
            icon={<MessageCircle size={18} />}
            prefixLabel={callingCode ? `+${callingCode}` : undefined}
            value={form.whatsappNumber}
            onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
            placeholder="24 000 0000"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  );
}
