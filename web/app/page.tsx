import Link from "next/link";

import { CardImage } from "@/components/card-image";
import { HeroBrand } from "@/components/hero-brand";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { getHealth, MtgApiError } from "@/lib/api";
import {
  getGameChangerNames,
  getRulesVersion,
} from "@/lib/rules/game-changers";

export default async function HomePage() {
  let health: { status: string; version: string } | null = null;
  let error: string | null = null;

  try {
    health = await getHealth();
  } catch (cause) {
    error =
      cause instanceof MtgApiError
        ? cause.message
        : "Erro inesperado ao consultar o backend.";
  }

  const gameChangers = getGameChangerNames();
  const rulesVersion = getRulesVersion();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-14 px-6 py-16">
      <HeroBrand />

      <div>
        <h2 className="text-2xl font-semibold text-fg">
          Qual é o nível de poder do seu deck de Commander?
        </h2>
        <p className="mt-4 text-muted">
          O Meus Brackets analisa sua lista e estima em qual dos 5 brackets oficiais ela se
          encaixa, do mais casual ao competitivo, apontando o que empurra o deck
          pra cima ou pra baixo na escala. Assim fica mais fácil combinar mesas
          com um nível de poder parecido.
        </p>
        <Link
          href="/decks"
          className="mt-6 inline-block rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-medium text-fg hover:opacity-90"
        >
          Ver exemplos de análise
        </Link>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-fg">
          Como calculamos o Bracket
        </h2>
        <p className="mt-3 text-muted">
          A escala vai de <strong className="text-fg">1 (Exhibition)</strong> a{" "}
          <strong className="text-fg">5 (cEDH)</strong>. O principal fator são
          as <strong className="text-fg">Game Changers</strong>, um grupo de
          cartas que a própria Wizards define como especialmente fortes pro
          formato: nenhuma nos brackets 1 e 2, até 3 no bracket 3, sem limite
          dali pra cima. Também entram na conta combos prontos, turnos extras,
          negação de terrenos em massa e mana muito acelerada.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gameChangers.slice(0, 4).map((name) => (
            <figure key={name}>
              <CardImage name={name} />
              <figcaption className="mt-1.5 text-xs text-muted">
                {name}
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">
          Regras versão {rulesVersion} · {gameChangers.length} Game Changers no
          total. Clique numa carta pra ver a arte em tela cheia.
        </p>

        <Link
          href="/como-funciona"
          className="mt-4 inline-block text-sm text-accent-secondary hover:underline"
        >
          Ver metodologia completa
        </Link>
      </section>

      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-muted">
              Status do serviço
            </h2>
            <p className="mt-1 text-sm text-muted">
              {error
                ? "Falha ao conectar com o backend"
                : `Versão ${health?.version}`}
            </p>
          </div>
          {error ? (
            <StatusBadge tone="error" label="offline" />
          ) : (
            <StatusBadge tone="ok" label="online" />
          )}
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-accent-primary/40 bg-accent-primary/10 p-3 text-sm text-fg">
            {error}
          </p>
        ) : null}
      </Panel>
    </main>
  );
}
