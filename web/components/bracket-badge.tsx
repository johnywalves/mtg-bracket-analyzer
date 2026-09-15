// Pill de bracket inspirado no destaque que brackcheck.com dá ao tier
// ("Bracket 2/4/5") nos cards de listagem — aqui com o nome oficial do tier
// (ver skill commander-format) e cor que sobe de intensidade com o poder.
const TIER_NAMES: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

const TIER_STYLES: Record<number, string> = {
  1: "border-accent-secondary/50 bg-accent-secondary/15 text-accent-secondary",
  2: "border-accent-secondary/50 bg-accent-secondary/15 text-accent-secondary",
  3: "border-white/30 bg-white/10 text-fg",
  4: "border-accent-primary/50 bg-accent-primary/15 text-accent-primary",
  5: "border-accent-primary/50 bg-accent-primary/15 text-accent-primary",
};

export function BracketBadge({
  tier,
  size = "sm",
  className = "",
}: {
  tier: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES[3];
  const name = TIER_NAMES[tier] ?? `Bracket ${tier}`;

  if (size === "lg") {
    return (
      <div
        className={`flex items-center justify-center gap-3 rounded-xl border px-4 py-2 ${style} ${className}`}
      >
        <span className="text-3xl font-bold leading-none">{tier}</span>
        <div className="leading-tight">
          <p className="text-xs uppercase tracking-wide opacity-80">Bracket</p>
          <p className="font-medium">{name}</p>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style} ${className}`}
    >
      <span className="font-semibold">{tier}</span>
      {name}
    </span>
  );
}
