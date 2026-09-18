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

// Fundo sólido + texto de contraste (não tint translúcido sobre o fundo
// escuro) — uma cor própria por tier, subindo de "casual" (verde) a
// "competitivo" (vermelho), em vez de reaproveitar só as duas cores de
// destaque.
const TIER_STYLES: Record<number, string> = {
  1: "border-transparent bg-[#2fbf71] text-[#052e16]",
  2: "border-transparent bg-accent-secondary text-[#032027]",
  3: "border-transparent bg-[#f5c93f] text-[#3a2900]",
  4: "border-transparent bg-[#ff8a3d] text-[#3a1600]",
  5: "border-transparent bg-accent-primary text-white",
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
        className={`flex items-center justify-center gap-3 rounded-xl border h-fit px-4 py-2 ${style} ${className}`}
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
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${style} ${className}`}
    >
      <span className="font-semibold">{tier}</span>
      {name}
    </span>
  );
}
