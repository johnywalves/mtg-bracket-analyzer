import Link from "next/link";

import { BracketBadge } from "@/components/bracket-badge";
import { ColorPips } from "@/components/color-pips";
import { ValidationBadge } from "@/components/validation-badge";
import type { DeckSummary } from "@/lib/types";

export function DeckCard({ deck }: { deck: DeckSummary }) {
  return (
    <Link
      href={`/decks/${deck.slug}`}
      className="block rounded-xl border border-white/20 bg-surface p-5 transition hover:border-accent-secondary/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-fg">{deck.name}</h2>
          <p className="mt-1 text-sm text-muted">{deck.commanders.join(" & ")}</p>
        </div>
        <BracketBadge tier={deck.bracket_estimate} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <ColorPips identity={deck.identity} />
        <ValidationBadge legal={deck.legal} />
      </div>
    </Link>
  );
}
