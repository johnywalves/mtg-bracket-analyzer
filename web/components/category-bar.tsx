import type { CategoryCount } from "@/lib/types";

const LABELS: Record<string, string> = {
  lands: "Terrenos",
  ramp: "Aceleração",
  draw: "Compra",
  removal: "Remoção",
  wipes: "Wipes",
};

export function CategoryBar({ category, count, target, gap }: CategoryCount) {
  const pct = Math.min(100, Math.round((count / Math.max(target, 1)) * 100));
  const tone = gap > 0 ? "bg-accent-primary" : "bg-accent-secondary";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-fg/80">{LABELS[category] ?? category}</span>
        <span className="text-muted">
          {count}/{target}
          {gap > 0 ? ` · faltam ${gap}` : ""}
        </span>
      </div>
      <div className="h-4 rounded-full bg-white/15">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
