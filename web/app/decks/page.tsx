import { DeckCard } from "@/components/deck-card";
import { listDecks } from "@/lib/mock/deck-service";

export default async function DecksPage() {
  const decks = await listDecks();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-fg">Decks</h1>
      <p className="mt-2 text-muted">Análise de bracket dos seus decks de Commander.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {decks.map((deck) => (
          <DeckCard key={deck.slug} deck={deck} />
        ))}
      </div>
    </main>
  );
}
