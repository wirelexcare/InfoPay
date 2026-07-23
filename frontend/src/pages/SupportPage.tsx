import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Headphones, MessageCircle, Send, Users } from "lucide-react";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";

interface SupportLinks {
  whatsappChannelUrl?: string;
  telegramGroupUrl?: string;
  telegramProfiles: { label: string; url: string }[];
}

export function SupportPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<SupportLinks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/support")
      .then(({ data }) => setLinks(data))
      .catch(() => setLinks({ telegramProfiles: [] }))
      .finally(() => setLoading(false));
  }, []);

  const hasAny =
    !!links &&
    (links.whatsappChannelUrl ||
      links.telegramGroupUrl ||
      links.telegramProfiles.length > 0);

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
          <Headphones size={24} />
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-white/70">
          Reach our team on any of the channels below.
        </p>
      </div>

      <Link
        to="/chat"
        className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-soft transition active:scale-[0.98] hover:border-primary/50"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink-900">Live Chat</p>
          <p className="truncate text-xs text-ink-500">
            Chat with our team, top-ups, questions, anything
          </p>
        </div>
      </Link>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : !hasAny ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-ink-700">
            No support channels available yet
          </p>
          <p className="mt-1 text-xs text-ink-400">Please check back soon.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {links!.whatsappChannelUrl && (
            <SupportLink
              href={links!.whatsappChannelUrl}
              icon={<MessageCircle size={20} />}
              tile="bg-green-100 text-green-600"
              title="WhatsApp channel"
              subtitle="Follow for updates and announcements"
            />
          )}
          {links!.telegramGroupUrl && (
            <SupportLink
              href={links!.telegramGroupUrl}
              icon={<Users size={20} />}
              tile="bg-sky-100 text-sky-600"
              title="Telegram group"
              subtitle="Join the community"
            />
          )}
          {links!.telegramProfiles.map((p, i) => (
            <SupportLink
              key={i}
              href={p.url}
              icon={<Send size={20} />}
              tile="bg-blue-100 text-blue-600"
              title={p.label || "Telegram"}
              subtitle="Chat with our team on Telegram"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SupportLink({
  href,
  icon,
  tile,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  tile: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition active:scale-[0.98] hover:border-primary/30"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tile}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink-900">{title}</p>
        <p className="truncate text-xs text-ink-500">{subtitle}</p>
      </div>
    </a>
  );
}
