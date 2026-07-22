// Premium metallic finishes per package tier — mirrors physical card-tier
// programs (graphite / bronze / silver / gold foil / platinum ...) rather
// than playful gamified badges. `text: "light"` picks white type for darker
// metals; `text: "dark"` picks near-black type for lighter/brighter ones.
export interface TierStyle {
  gradient: string;
  text: "light" | "dark";
}

export const TIER_STYLES: Record<string, TierStyle> = {
  standard: { gradient: "from-neutral-700 via-neutral-600 to-neutral-800", text: "light" },
  bronze: { gradient: "from-[#8a5a2b] via-[#c17f42] to-[#5c3a1e]", text: "light" },
  silver: { gradient: "from-slate-300 via-zinc-100 to-slate-400", text: "dark" },
  gold: { gradient: "from-[#bf953f] via-[#fcf6ba] to-[#aa771c]", text: "dark" },
  platinum: { gradient: "from-slate-200 via-zinc-50 to-slate-300", text: "dark" },
  diamond: { gradient: "from-sky-100 via-white to-cyan-100", text: "dark" },
  master: { gradient: "from-violet-800 via-purple-600 to-violet-900", text: "light" },
  grandmaster: { gradient: "from-fuchsia-800 via-pink-600 to-fuchsia-900", text: "light" },
  challenger: { gradient: "from-orange-800 via-red-600 to-orange-900", text: "light" },
  legend: { gradient: "from-yellow-600 via-amber-300 to-yellow-700", text: "dark" },
};

export const DEFAULT_TIER_STYLE: TierStyle = {
  gradient: "from-ink-700 via-ink-600 to-ink-800",
  text: "light",
};

export function tierStyle(title: string): TierStyle {
  return TIER_STYLES[title.trim().toLowerCase()] ?? DEFAULT_TIER_STYLE;
}

export function tierTextClasses(style: TierStyle) {
  const isLight = style.text === "light";
  return {
    isLight,
    main: isLight ? "text-white" : "text-ink-900",
    muted: isLight ? "text-white/70" : "text-ink-900/60",
    divider: isLight ? "border-white/15" : "border-ink-900/10",
    pill: isLight ? "bg-white/15" : "bg-ink-900/10",
  };
}
