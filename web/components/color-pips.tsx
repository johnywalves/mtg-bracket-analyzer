const COLOR_DOTS: Record<string, string> = {
  W: "bg-[#f8f6d8]",
  U: "bg-[#0e68ab]",
  B: "bg-[#150b00]",
  R: "bg-[#d3202a]",
  G: "bg-[#00733e]",
};

/** Bolinhas WUBRG pra identidade de cor (ex.: "BGUW"). "C" = incolor. */
export function ColorPips({ identity }: { identity: string }) {
  if (identity === "C" || identity.length === 0) {
    return <span className="text-xs text-muted">incolor</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {identity.split("").map((color, i) => (
        <span
          key={`${color}-${i}`}
          className={`h-3 w-3 rounded-full border border-white/40 ${COLOR_DOTS[color] ?? "bg-muted"}`}
          title={color}
        />
      ))}
    </div>
  );
}
