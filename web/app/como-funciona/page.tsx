import { Fragment } from "react";

import { BracketBadge } from "@/components/bracket-badge";
import { CardImage, CardNameLink } from "@/components/card-image";
import { Panel } from "@/components/panel";
import {
  getGameChangerNames,
  getRulesVersion,
  getSignalKeys,
} from "@/lib/rules/game-changers";

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

const SIGNAL_DESCRIPTIONS: Record<
  string,
  { before: string; examples: string[]; after: string }
> = {
  extra_turns: {
    before: "Efeitos que dão turnos adicionais (ex.: ",
    examples: ["Time Warp", "Nexus of Fate"],
    after:
      "). Multiplicam o número de land drops, ativações e ataques do jogador, então pesam a favor de um bracket mais alto.",
  },
  mass_land_denial: {
    before: "Cartas que destroem ou travam os terrenos de todos os oponentes (ex.: ",
    examples: ["Armageddon", "Winter Orb"],
    after:
      "). É considerado um efeito de alto impacto pelo próprio sistema de brackets da Wizards, então soma na estimativa.",
  },
  fast_mana: {
    before:
      "Aceleração de mana muito acima da curva normal, sem custo de vida ou setup relevante (ex.: ",
    examples: ["Sol Ring", "Mana Crypt", "Ancient Tomb"],
    after:
      "). Permite adiantar a jogada em vários turnos e é um sinal clássico de mesa competitiva.",
  },
};

/** Lista de nomes de carta em prosa, cada um clicável (mesmo padrão dos Game Changers). */
function CardNameList({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <Fragment key={name}>
          {i > 0 ? ", " : null}
          <CardNameLink name={name} />
        </Fragment>
      ))}
    </>
  );
}

export default function ComoFuncionaPage() {
  const gameChangers = getGameChangerNames();
  const rulesVersion = getRulesVersion();
  const signals = getSignalKeys();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-fg">
        Como calculamos o Bracket
      </h1>
      <p className="mt-3 text-justify text-muted">
        O sistema de brackets é oficial da Wizards of the Coast, pensado pra
        ajudar grupos a combinarem mesas com nível de poder parecido antes de
        sentar pra jogar. O Meus Brackets estima em qual das 5 faixas o seu deck
        se encaixa a partir de alguns sinais: presença de{" "}
        <strong className="text-fg">Game Changers</strong>, presença de{" "}
        <strong className="text-fg">combos</strong> prontos e sinais adicionais
        como {signals.map((key) => SIGNAL_LABELS[key] ?? key).join(", ")}.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Regras do formato</h2>
        <p className="mt-3 text-justify text-muted">
          Commander é jogado com exatamente <strong className="text-fg">100 cartas</strong> (99 +
          1 comandante), em modo <strong className="text-fg">singleton</strong>: nenhum nome
          repetido, exceto terrenos básicos. O comandante precisa ser uma criatura lendária (ou
          uma carta que diga explicitamente "pode ser seu comandante"), e toda carta do deck
          precisa ter identidade de cor <strong className="text-fg">dentro</strong> da identidade
          do comandante, considerando símbolos de mana no custo e no texto, não a cor do frame.
          Cartas na lista de banidos (mantida e atualizada pela própria Wizards) não podem entrar
          no deck. Cada jogador começa com <strong className="text-fg">40 pontos de vida</strong>{" "}
          numa mesa padrão de 4 jogadores, e 21+ de dano de combate vindo de um único comandante
          já elimina o jogador, independente da vida restante.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Os 5 tiers</h2>
        <div className="mt-4 space-y-3">
          {TIERS.map(({ tier, description }) => (
            <div
              key={tier}
              className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_1fr]"
            >
              <BracketBadge tier={tier} size="lg" className="flex-1" />
              <Panel>
                <p className="text-justify text-sm text-muted">{description}</p>
              </Panel>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Game Changers</h2>
        <p className="mt-3 text-justify text-muted">
          É uma lista curada e periodicamente revisada pela própria Wizards, não
          algo que o Meus Brackets decide sozinho. Cartas dessa lista distorcem
          o jogo de forma desproporcional: vantagem de cartas explosiva, remoção
          em massa muito eficiente, tutores irrestritos, entre outros efeitos.
          Nenhuma é permitida nos brackets 1 e 2, o bracket 3 permite até 3, e
          do bracket 4 em diante não há limite. Lista completa (regras versão{" "}
          {rulesVersion}, {gameChangers.length} cartas). Clique numa carta pra
          ver a arte em tela cheia.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {gameChangers.map((name) => (
            <figure key={name}>
              <CardImage name={name} />
              <figcaption className="mt-1.5 text-xs text-muted">
                {name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">
          Combos e outros sinais
        </h2>
        <p className="mt-3 text-justify text-muted">
          Além das Game Changers, o Meus Brackets olha se o deck tem combos
          prontos (peças que juntas geram um loop infinito ou uma vitória
          imediata) e sinais de consistência acima da média, como{" "}
          {signals.map((key) => SIGNAL_LABELS[key] ?? key).join(", ")}. Quanto
          mais desses sinais aparecem juntos, mais a estimativa sobe na escala.
        </p>

        <div className="mt-4 space-y-3">
          {signals.map((key) => {
            const info = SIGNAL_DESCRIPTIONS[key];
            return (
              <Panel key={key}>
                <h3 className="font-medium text-fg">{SIGNAL_LABELS[key] ?? key}</h3>
                <p className="mt-1.5 text-justify text-sm text-muted">
                  {info ? (
                    <>
                      {info.before}
                      <CardNameList names={info.examples} />
                      {info.after}
                    </>
                  ) : (
                    "Sinal adicional considerado na estimativa de bracket."
                  )}
                </p>
              </Panel>
            );
          })}
        </div>
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
