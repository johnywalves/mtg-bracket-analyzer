import { BracketBadge } from "@/components/bracket-badge";
import { CardImage } from "@/components/card-image";
import { Panel } from "@/components/panel";
import { getGameChangerNames, getRulesVersion, getSignalKeys } from "@/lib/rules/game-changers";

const TIERS: { tier: number; description: string }[] = [
  {
    tier: 1,
    description:
      "Exhibition: decks temáticos e ultra-casuais, montados pra diversão em torno de um tema, não pra vencer com eficiência.",
  },
  {
    tier: 2,
    description:
      "Core: nível de deck pronto de loja (precon), sem otimizações agressivas. Ponto de partida da maioria das mesas.",
  },
  {
    tier: 3,
    description:
      "Upgraded: deck ajustado com melhorias pontuais, permite até 3 Game Changers, curva mais consistente.",
  },
  {
    tier: 4,
    description:
      "Optimized: alto poder, sem restrição de Game Changers, mas ainda abaixo do padrão totalmente competitivo.",
  },
  {
    tier: 5,
    description:
      "cEDH: competitivo de ponta a ponta, com combos rápidos, interação máxima e mana eficiente ao extremo.",
  },
];

const SIGNAL_LABELS: Record<string, string> = {
  extra_turns: "Turnos extras",
  mass_land_denial: "Negação de terrenos em massa",
  fast_mana: "Mana muito acelerada",
};

export default function ComoFuncionaPage() {
  const gameChangers = getGameChangerNames();
  const rulesVersion = getRulesVersion();
  const signals = getSignalKeys();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-fg">Como calculamos o Bracket</h1>
      <p className="mt-3 text-muted">
        O sistema de brackets é oficial da Wizards of the Coast, pensado pra ajudar grupos a
        combinarem mesas com nível de poder parecido antes de sentar pra jogar. O Meus Brackets
        estima em qual das 5 faixas o seu deck se encaixa a partir de alguns sinais: presença de{" "}
        <strong className="text-fg">Game Changers</strong>, presença de{" "}
        <strong className="text-fg">combos</strong> prontos e sinais adicionais como{" "}
        {signals.map((key) => SIGNAL_LABELS[key] ?? key).join(", ")}.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Os 5 tiers</h2>
        <div className="mt-4 space-y-3">
          {TIERS.map(({ tier, description }) => (
            <Panel key={tier}>
              <div className="flex items-start gap-4">
                <BracketBadge tier={tier} size="lg" />
                <p className="mt-1 text-sm text-muted">{description}</p>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Game Changers</h2>
        <p className="mt-3 text-muted">
          É uma lista curada e periodicamente revisada pela própria Wizards, não algo que o Meus
          Brackets decide sozinho. Cartas dessa lista distorcem o jogo de forma desproporcional:
          vantagem de cartas explosiva, remoção em massa muito eficiente, tutores irrestritos, entre
          outros efeitos. Nenhuma é permitida nos brackets 1 e 2, o bracket 3 permite até 3, e do
          bracket 4 em diante não há limite. Lista completa (regras versão {rulesVersion},{" "}
          {gameChangers.length} cartas). Clique numa carta pra ver a arte em tela cheia.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {gameChangers.map((name) => (
            <figure key={name}>
              <CardImage name={name} />
              <figcaption className="mt-1.5 text-xs text-muted">{name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Combos e outros sinais</h2>
        <p className="mt-3 text-muted">
          Além das Game Changers, o Meus Brackets olha se o deck tem combos prontos (peças que
          juntas geram um loop infinito ou uma vitória imediata) e sinais de consistência acima da
          média, como {signals.map((key) => SIGNAL_LABELS[key] ?? key).join(", ")}. Quanto mais
          desses sinais aparecem juntos, mais a estimativa sobe na escala.
        </p>
      </section>

      <p className="mt-12 text-xs text-muted">
        Imagens e dados de cartas © Wizards of the Coast, via{" "}
        <a
          href="https://scryfall.com"
          target="_blank"
          rel="noreferrer"
          className="text-accent-secondary hover:underline"
        >
          Scryfall
        </a>
        . Fan content não oficial, sem afiliação com a Wizards of the Coast.
      </p>
    </main>
  );
}
