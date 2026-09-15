"use client";

import { useMemo, useState } from "react";

import { CardImage, CardNameLink } from "@/components/card-image";
import { ManaCost } from "@/components/mana-cost";
import type { DeckCardEntry } from "@/lib/types";

// Ordem convencional de decklist (Moxfield/Archidekt): criaturas primeiro,
// terrenos por último. Tipo fora da lista cai num grupo "Outros" no fim.
const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Battle",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
];

const TYPE_LABELS: Record<string, string> = {
  Creature: "Criaturas",
  Planeswalker: "Planeswalkers",
  Battle: "Batalhas",
  Instant: "Mágicas instantâneas",
  Sorcery: "Feitiços",
  Artifact: "Artefatos",
  Enchantment: "Encantamentos",
  Land: "Terrenos",
};

function groupByType(cards: DeckCardEntry[]) {
  const groups = new Map<string, DeckCardEntry[]>();
  for (const card of cards) {
    const list = groups.get(card.type) ?? [];
    list.push(card);
    groups.set(card.type, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  const known = TYPE_ORDER.filter((type) => groups.has(type));
  const rest = [...groups.keys()].filter((type) => !TYPE_ORDER.includes(type)).sort();
  return [...known, ...rest].map((type) => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    cards: groups.get(type) ?? [],
  }));
}

function CrownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 8.5 7 11l5-6 5 6 4-2.5-1.7 9.5H4.7L3 8.5Zm2.2 12h13.6v2H5.2v-2Z" />
    </svg>
  );
}

function NameRow({ card, isCommander }: { card: DeckCardEntry; isCommander: boolean }) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm ${
        isCommander
          ? "border-l-2 border-accent-secondary bg-accent-secondary/10 text-fg"
          : "text-fg/90 hover:bg-white/5"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {isCommander ? (
          <CrownIcon className="h-3.5 w-3.5 shrink-0 text-accent-secondary" />
        ) : (
          <span className="mr-0.5 shrink-0 text-muted">{card.quantity}x</span>
        )}
        <CardNameLink name={card.name} />
      </span>
      {card.mana_cost && <ManaCost cost={card.mana_cost} />}
    </li>
  );
}

function ImageTile({ card, isCommander }: { card: DeckCardEntry; isCommander: boolean }) {
  return (
    <figure>
      <CardImage
        name={card.name}
        className={`bg-surface transition hover:scale-105 ${
          isCommander
            ? "border-2 border-accent-secondary shadow-[0_0_0_2px_rgba(0,255,255,0.35)]"
            : "border border-white/10"
        }`}
      />
      <figcaption className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-muted">
        {isCommander ? (
          <>
            <CrownIcon className="h-3 w-3 text-accent-secondary" />
            <span className="text-accent-secondary">comandante</span>
          </>
        ) : (
          card.quantity > 1 && `${card.quantity}x`
        )}
      </figcaption>
    </figure>
  );
}

export function DeckCardList({
  cards,
  commanders = [],
}: {
  cards: DeckCardEntry[];
  commanders?: string[];
}) {
  const [view, setView] = useState<"name" | "image">("name");
  const isCommander = (name: string) => commanders.includes(name);
  const groups = useMemo(() => groupByType(cards), [cards]);
  const total = cards.reduce((sum, card) => sum + card.quantity, 0);
  const commanderCards = cards.filter((card) => isCommander(card.name));

  if (cards.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-fg">
          Lista de cartas <span className="text-sm font-normal text-muted">({total})</span>
        </h2>
        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("name")}
            aria-pressed={view === "name"}
            className={`rounded-full px-3 py-1 transition ${
              view === "name" ? "bg-accent-secondary text-[#032027] font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            Por nome
          </button>
          <button
            type="button"
            onClick={() => setView("image")}
            aria-pressed={view === "image"}
            className={`rounded-full px-3 py-1 transition ${
              view === "image" ? "bg-accent-secondary text-[#032027] font-semibold" : "text-muted hover:text-fg"
            }`}
          >
            Por imagens
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {commanderCards.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-accent-secondary">
              <CrownIcon className="h-3.5 w-3.5" />
              {commanderCards.length > 1 ? "Comandantes" : "Comandante"}
            </h3>

            {view === "name" ? (
              <ul className="mt-2 space-y-0.5">
                {commanderCards.map((card) => (
                  <NameRow key={card.name} card={card} isCommander />
                ))}
              </ul>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {commanderCards.map((card) => (
                  <ImageTile key={card.name} card={card} isCommander />
                ))}
              </div>
            )}
          </section>
        )}

        {groups.map((group) => {
          const rest = group.cards.filter((card) => !isCommander(card.name));
          if (rest.length === 0) {
            return null;
          }

          return (
            <section key={group.type}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {group.label}{" "}
                <span className="font-normal normal-case">
                  ({rest.reduce((sum, card) => sum + card.quantity, 0)})
                </span>
              </h3>

              {view === "name" ? (
                <ul className="mt-2 space-y-0.5">
                  {rest.map((card) => (
                    <NameRow key={card.name} card={card} isCommander={false} />
                  ))}
                </ul>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {rest.map((card) => (
                    <ImageTile key={card.name} card={card} isCommander={false} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
