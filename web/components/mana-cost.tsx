const COLORS = ["W", "U", "B", "R", "G"] as const;

/**
 * Símbolo genérico (número/X) — sem ícone próprio no /mana, então simula o
 * símbolo incolor real da carta: círculo bege/cinza com número preto.
 */
function GenericPip({ symbol }: { symbol: string }) {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-gradient-to-br from-[#e9e4d8] to-[#c2bcae] text-[11px] font-extrabold leading-none text-black drop-shadow-[1px_1px_0_rgba(255,255,255,0.6)]">
      {symbol}
    </span>
  );
}

/** Custo de mana ("{4}{B}{B}") em ícones — reaproveita os SVGs de /mana usados no ColorPips. */
export function ManaCost({ cost }: { cost: string }) {
  const symbols = cost.match(/\{([^}]+)\}/g)?.map((s) => s.slice(1, -1)) ?? [];
  if (symbols.length === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {symbols.map((symbol, i) => {
        const color = symbol.toUpperCase();
        if (COLORS.includes(color as (typeof COLORS)[number])) {
          return (
            <img
              key={i}
              src={`/mana/${color}.svg`}
              alt={color}
              title={color}
              className="h-4 w-4 rounded-full drop-shadow-[1px_1px_0_rgba(255,255,255,0.9)]"
            />
          );
        }
        return <GenericPip key={i} symbol={symbol} />;
      })}
    </div>
  );
}
