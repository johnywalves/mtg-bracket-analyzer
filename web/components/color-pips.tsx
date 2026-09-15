const COLORS = ["W", "U", "B", "R", "G"] as const;

/** Bolas WUBRG oficiais (símbolos Scryfall) pra identidade de cor (ex.: "BGUW"). "C" = incolor. */
export function ColorPips({ identity }: { identity: string }) {
  if (identity === "C" || identity.length === 0) {
    return <span className="text-xs text-muted">incolor</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {identity.split("").map((color, i) => (
        <img
          key={`${color}-${i}`}
          src={`/mana/${COLORS.includes(color as (typeof COLORS)[number]) ? color : "C"}.svg`}
          alt={color}
          title={color}
          className="h-5 w-5 rounded-full drop-shadow-[1px_1px_0_rgba(255,255,255,0.9)]"
        />
      ))}
    </div>
  );
}
