// MOCK — trocar por lib/api.ts quando GET /decks e /decks/{name}/analysis
// existirem no backend (ver project-plan.md §Phase 10 API contract).
import type { DeckReport, DeckSummary } from "@/lib/types";

/** Mesma lógica de backend/mtg_analyzer/data/deck_library.py::slugify. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const MOCK_DECKS: DeckReport[] = [
  {
    name: "Sauron, the Dark Lord",
    commanders: ["Sauron, the Dark Lord"],
    identity: "BR",
    validation: {
      legal: true,
      card_count: 100,
      commander_identity: "BR",
      issues: [],
      warnings: [],
    },
    categories: [
      { category: "lands", count: 36, target: 37, gap: 1 },
      { category: "ramp", count: 9, target: 10, gap: 1 },
      { category: "draw", count: 11, target: 10, gap: 0 },
      { category: "removal", count: 8, target: 10, gap: 2 },
      { category: "wipes", count: 2, target: 3, gap: 1 },
    ],
    curve: [
      { cmc: 0, count: 2 },
      { cmc: 1, count: 8 },
      { cmc: 2, count: 15 },
      { cmc: 3, count: 14 },
      { cmc: 4, count: 10 },
      { cmc: 5, count: 6 },
      { cmc: 6, count: 4 },
      { cmc: 7, count: 3 },
    ],
    game_changers: ["Demonic Tutor", "Cyclonic Rift", "Vampiric Tutor", "Sol Ring"],
    combos: ["Infinite mana: Basalt Monolith + Rings of Brighthearth"],
    bracket_estimate: 4,
    bracket_rationale: "4 Game Changers + densidade de tutores empurram pro bracket 4 (alto poder).",
  },
  {
    name: "Frodo & Sam",
    commanders: ["Frodo, Adventurous Hobbit", "Sam, Loyal Attendant"],
    identity: "GW",
    validation: {
      legal: true,
      card_count: 100,
      commander_identity: "GW",
      issues: [],
      warnings: ["2 cartas não resolvidas contra o banco local — reconfirme nomes"],
    },
    categories: [
      { category: "lands", count: 38, target: 37, gap: 0 },
      { category: "ramp", count: 11, target: 10, gap: 0 },
      { category: "draw", count: 8, target: 10, gap: 2 },
      { category: "removal", count: 6, target: 10, gap: 4 },
      { category: "wipes", count: 1, target: 3, gap: 2 },
    ],
    curve: [
      { cmc: 0, count: 3 },
      { cmc: 1, count: 10 },
      { cmc: 2, count: 16 },
      { cmc: 3, count: 12 },
      { cmc: 4, count: 8 },
      { cmc: 5, count: 5 },
      { cmc: 6, count: 3 },
      { cmc: 7, count: 2 },
    ],
    game_changers: [],
    combos: [],
    bracket_estimate: 2,
    bracket_rationale: "Sem Game Changers, curva baixa, foco em value incremental — bracket 2.",
  },
  {
    name: "Nazgûl Tribal (rascunho)",
    commanders: ["The Nazgûl"],
    identity: "B",
    validation: {
      legal: false,
      card_count: 97,
      commander_identity: "B",
      issues: [
        "97 cartas no total — faltam 3 pra completar 100 (incl. comandante)",
        "1 carta fora da identidade de cor do comandante (B): Lightning Bolt",
      ],
      warnings: [],
    },
    categories: [
      { category: "lands", count: 34, target: 37, gap: 3 },
      { category: "ramp", count: 7, target: 10, gap: 3 },
      { category: "draw", count: 9, target: 10, gap: 1 },
      { category: "removal", count: 12, target: 10, gap: 0 },
      { category: "wipes", count: 4, target: 3, gap: 0 },
    ],
    curve: [
      { cmc: 0, count: 1 },
      { cmc: 1, count: 6 },
      { cmc: 2, count: 13 },
      { cmc: 3, count: 11 },
      { cmc: 4, count: 9 },
      { cmc: 5, count: 7 },
      { cmc: 6, count: 4 },
      { cmc: 7, count: 3 },
    ],
    game_changers: ["Cyclonic Rift"],
    combos: [],
    bracket_estimate: 3,
    bracket_rationale: "Rascunho ainda ilegal (contagem + cor fora de identidade) — corrija antes de jogar.",
  },
];

export function toSummary(report: DeckReport): DeckSummary {
  return {
    slug: slugify(report.name ?? "deck-sem-nome"),
    name: report.name ?? "Deck sem nome",
    commanders: report.commanders,
    identity: report.identity,
    bracket_estimate: report.bracket_estimate,
    legal: report.validation.legal,
  };
}
