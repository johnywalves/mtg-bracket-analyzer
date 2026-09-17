"use client";

import { useMemo, useState } from "react";

import { DeckCard } from "@/components/deck-card";
import type { DeckSummary } from "@/lib/types";

const WUBRG = ["W", "U", "B", "R", "G"] as const;

/** Compara ignorando acentos/caso ("Nazgûl" casa com "nazgul"). */
function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Deck passa no filtro de cores se a identidade inteira cabe nas cores marcadas. */
function identityFits(identity: string, selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  if (identity === "C" || identity.length === 0) return false;
  return identity.split("").every((c) => selected.has(c));
}

interface CollectionGroup {
  year: number;
  set_name: string;
  decks: DeckSummary[];
}

export function DecksBrowser({ decks }: { decks: DeckSummary[] }) {
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<ReadonlySet<string>>(new Set());

  function toggleColor(color: string) {
    const next = new Set(colors);
    if (next.has(color)) {
      next.delete(color);
    } else {
      next.add(color);
    }
    setColors(next);
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return decks.filter((deck) => {
      if (!identityFits(deck.identity, colors)) return false;
      if (!q) return true;
      const haystack = normalize([deck.name, ...deck.commanders].join(" "));
      return haystack.includes(q);
    });
  }, [decks, query, colors]);

  const customDecks = filtered.filter((deck) => deck.kind === "custom");

  // Precons agrupados por coleção de ano, mais recente primeiro.
  const collections = useMemo(() => {
    const byCollection = new Map<string, CollectionGroup>();
    for (const deck of filtered) {
      if (deck.kind !== "precon") continue;
      const key = `${deck.year ?? 0}|${deck.set_name ?? ""}`;
      const group = byCollection.get(key);
      if (group) {
        group.decks.push(deck);
      } else {
        byCollection.set(key, {
          year: deck.year ?? 0,
          set_name: deck.set_name ?? "Precon",
          decks: [deck],
        });
      }
    }
    return [...byCollection.values()].sort((a, b) => b.year - a.year);
  }, [filtered]);

  const total = filtered.length;

  return (
    <div>
      {/* Busca por nome/comandante + filtro de cores (identidade ⊆ seleção). */}
      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-white/20 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou comandante…"
          aria-label="Buscar deck por nome ou comandante"
          className="w-full rounded-lg border border-white/20 bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-accent-secondary/70 focus:outline-none sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Cores:</span>
          {WUBRG.map((color) => {
            const active = colors.has(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                aria-pressed={active}
                title={`Filtrar por ${color}`}
                className={`rounded-full transition ${
                  active
                    ? "ring-2 ring-accent-secondary drop-shadow-[1px_1px_0_rgba(255,255,255,0.9)]"
                    : "opacity-40 hover:opacity-80"
                }`}
              >
                <img src={`/mana/${color}.svg`} alt={color} className="h-6 w-6 rounded-full" />
              </button>
            );
          })}
          {(query || colors.size > 0) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setColors(new Set());
              }}
              className="ml-2 text-xs text-muted underline hover:text-fg"
            >
              limpar
            </button>
          )}
        </div>
      </div>

      {total === 0 && (
        <p className="mt-8 text-sm text-muted">Nenhum deck encontrado com esses filtros.</p>
      )}

      {customDecks.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-fg">Seus decks</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {customDecks.map((deck) => (
              <DeckCard key={deck.slug} deck={deck} />
            ))}
          </div>
        </section>
      )}

      {collections.map((group) => (
        <section key={`${group.year}-${group.set_name}`} className="mt-10">
          <h2 className="text-xl font-semibold text-fg">
            Precons · {group.year}
          </h2>
          <p className="mt-1 text-sm text-muted">{group.set_name}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.decks.map((deck) => (
              <DeckCard key={deck.slug} deck={deck} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
