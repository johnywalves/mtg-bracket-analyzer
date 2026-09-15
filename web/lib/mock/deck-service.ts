// MOCK — trocar por chamadas em lib/api.ts (mtgFetch) quando GET /decks e
// GET /decks/{name}/analysis existirem no backend. Assinaturas de propósito
// iguais às que as versões reais terão, pra trocar sem mexer nas páginas.
import type { DeckReport, DeckSummary } from "@/lib/types";

import { MOCK_DECKS, slugify, toSummary } from "./decks";

export async function listDecks(): Promise<DeckSummary[]> {
  return MOCK_DECKS.map(toSummary);
}

export async function getDeckReport(slug: string): Promise<DeckReport | null> {
  const report = MOCK_DECKS.find((deck) => slugify(deck.name ?? "") === slug);
  return report ?? null;
}
