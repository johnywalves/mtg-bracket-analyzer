import { Fragment } from "react";

import { BracketBadge } from "@/components/bracket-badge";
import { CardImage, CardNameLink } from "@/components/card-image";
import { ColorPips } from "@/components/color-pips";
import { Panel } from "@/components/panel";
import {
  getGameChangerNames,
  getGameChangersWithColors,
  getRulesVersion,
  getSignalKeys,
} from "@/lib/rules/game-changers";

const WUBRG = ["W", "U", "B", "R", "G"] as const;

const COLOR_GROUP_LABELS: Record<string, string> = {
  W: "Branco",
  U: "Azul",
  B: "Preto",
  R: "Vermelho",
  G: "Verde",
  multi: "Multicolor",
  C: "Incolor",
};

/**
 * Agrupa Game Changers por identidade de cor: mono primeiro (ordem WUBRG),
 * depois multicolor, depois incolor. Cada carta multicolor guarda sua própria
 * identidade completa (ex.: "WU") pra render individual do ColorPips.
 */
function groupByColor(
  cards: { name: string; colors: string[] }[],
): { key: string; cards: { name: string; identity: string }[] }[] {
  const groups = new Map<string, { name: string; identity: string }[]>();

  for (const { name, colors } of cards) {
    const key =
      colors.length === 0 ? "C" : colors.length === 1 ? colors[0] : "multi";
    const identity = colors.length === 0 ? "C" : colors.join("");
    groups.set(key, [...(groups.get(key) ?? []), { name, identity }]);
  }

  const order = [...WUBRG, "multi", "C"];
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({
      key,
      cards: groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

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
      "). Multiplicam o número de land drops, ativações e ataques do jogador. Se o efeito é repetível/encadeável (um permanente, ou um feitiço com texto do tipo \"sempre que\"/\"no início de\"), o piso da estimativa vai pra pelo menos o bracket 4; se é um feitiço avulso, de uso único, o piso é só o bracket 2.",
  },
  mass_land_denial: {
    before:
      "Cartas que destroem ou travam os terrenos de todos os oponentes (ex.: ",
    examples: ["Armageddon", "Winter Orb"],
    after:
      "). É considerado um efeito de alto impacto pelo próprio sistema de brackets da Wizards: uma única ocorrência já trava o piso da estimativa em pelo menos o bracket 4.",
  },
  fast_mana: {
    before:
      "Aceleração de mana muito acima da curva normal, sem custo de vida ou setup relevante (ex.: ",
    examples: ["Sol Ring", "Mana Crypt", "Ancient Tomb"],
    after:
      "). Permite adiantar a jogada em vários turnos e é um sinal clássico de mesa competitiva.",
  },
};

const SOURCES: { label: string; href: string; note: string }[] = [
  {
    label: "Introducing Commander Brackets (Beta)",
    href: "https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta",
    note: "Anúncio oficial da Wizards of the Coast do sistema de 5 brackets e da lista de Game Changers.",
  },
  {
    label: "Commander Brackets Beta Update",
    href: "https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026",
    note: "Atualizações periódicas da Wizards sobre a lista de Game Changers e as regras de bracket.",
  },
  {
    label: "Regras oficiais do formato Commander",
    href: "https://mtgcommander.net/index.php/rules/",
    note: "100 cartas, singleton, identidade de cor, vida inicial e demais regras do formato.",
  },
  {
    label: "Scryfall",
    href: "https://scryfall.com",
    note: "Dados e imagens de carta, usados via Fan Content Policy da Wizards.",
  },
  {
    label: "Commander Spellbook",
    href: "https://commanderspellbook.com",
    note: "Base de combos usada pra detectar peças de combo prontas no deck.",
  },
  {
    label: "Commander Spellbook — Syntax guide (bracket tags)",
    href: "https://commanderspellbook.com/syntax-guide/#bracket",
    note: "Classificação de bracket que o próprio Commander Spellbook atribui a cada combo, usada pra estimar a força de um combo encontrado no deck.",
  },
];

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
  const gameChangersByColor = groupByColor(getGameChangersWithColors());
  const rulesVersion = getRulesVersion();
  const signals = getSignalKeys();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
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
          Commander é jogado com exatamente{" "}
          <strong className="text-fg">100 cartas</strong> (99 + 1 comandante),
          em modo <strong className="text-fg">singleton</strong>: nenhum nome
          repetido, exceto terrenos básicos. O comandante precisa ser uma
          criatura lendária (ou uma carta que diga explicitamente "pode ser seu
          comandante"), e toda carta do deck precisa ter identidade de cor{" "}
          <strong className="text-fg">dentro</strong> da identidade do
          comandante, considerando símbolos de mana no custo e no texto, não a
          cor do frame. Cartas na lista de banidos (mantida e atualizada pela
          própria Wizards) não podem entrar no deck. Cada jogador começa com{" "}
          <strong className="text-fg">40 pontos de vida</strong> numa mesa
          padrão de 4 jogadores, e 21+ de dano de combate vindo de um único
          comandante já elimina o jogador, independente da vida restante.
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
        <h2 className="text-xl font-semibold text-fg">
          Como o cálculo funciona
        </h2>
        <p className="mt-3 text-justify text-muted">
          A estimativa <strong className="text-fg">não</strong> é uma nota
          somada/ponderada. É um sistema de{" "}
          <strong className="text-fg">piso e teto</strong>: cada sinal oficial
          (Game Changers, negação de terrenos, turnos extras, combos) empurra o{" "}
          <strong className="text-fg">piso</strong> pra cima de forma
          independente — nenhum deles é opcional ou "pesa mais que o outro".
          Só depois disso, sinais heurísticos (mana rápida, tutores,
          interação) podem empurrar o número final <strong>1 bracket acima
          do piso</strong>, mas nunca abrem o teto sozinhos nem substituem os
          sinais oficiais.
        </p>
        <div className="mt-4 space-y-3">
          <Panel>
            <h3 className="font-medium text-fg">1. Piso por Game Changers</h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              0 Game Changers → piso 1. 1 a 3 → piso pelo menos 3. 4 ou mais →
              piso pelo menos 4 (reflete o próprio limite oficial: brackets 1
              e 2 não permitem nenhuma, o bracket 3 permite até 3).
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">
              2. Piso por negação massiva de terrenos
            </h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              Qualquer ocorrência já trava o piso em pelo menos o bracket 4 —
              é tratado como efeito de alto impacto por si só.
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">3. Piso por turno extra</h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              Repetível/encadeável (permanente, ou feitiço com gatilho
              recorrente) → piso pelo menos 4. Feitiço avulso, de uso único →
              piso pelo menos 2.
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">4. Piso por combo pronto</h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              Usa a bracket tag que o Commander Spellbook atribui ao combo
              quando ela existe (Ruthless → piso 4, Powerful/Spicy → piso 3,
              Oddball/Core → piso 2, Exhibition → piso 1). Sem essa
              classificação, cai no heurístico: combo de duas cartas com
              ambas custando até 3 de mana → piso pelo menos 4; qualquer
              outro combo completo → piso pelo menos 3.
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">5. Teto</h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              O teto é sempre pelo menos o bracket 3, ou piso + 1 quando o
              piso já passou de 2 — limitado ao bracket 5. Ou seja, o teto
              nunca fica abaixo do piso nem passa de 5.
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">
              6. Ajuste fino (só dentro do teto)
            </h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              Com pelo menos 2 cartas de mana rápida curada, um tutor amplo
              (busca qualquer carta, não um tipo específico), ou densidade
              alta de interação (≥15% das cartas não-terreno), a estimativa
              final sobe 1 bracket acima do piso — sem nunca ultrapassar o
              teto calculado no passo 5.
            </p>
          </Panel>
          <Panel>
            <h3 className="font-medium text-fg">
              Sinal informativo: velocidade do deck
            </h3>
            <p className="mt-1.5 text-justify text-sm text-muted">
              Calculamos também uma velocidade estimada (baixa/média/alta) a
              partir da curva de mana, mana rápida, densidade de tutores e
              presença de combo. Esse número aparece na análise só como
              contexto — ele sozinho nunca move o piso, o teto nem o bracket
              final.
            </p>
          </Panel>
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

        <div className="mt-6 space-y-8">
          {gameChangersByColor.map(({ key, cards }) => (
            <div key={key}>
              <div className="flex items-center gap-2">
                {key === "multi" || key === "C" ? (
                  <span className="text-sm font-medium text-fg">
                    {COLOR_GROUP_LABELS[key]}
                  </span>
                ) : (
                  <ColorPips identity={key} />
                )}
                {key !== "multi" && key !== "C" ? (
                  <span className="text-sm font-medium text-fg">
                    {COLOR_GROUP_LABELS[key]}
                  </span>
                ) : null}
                <span className="text-sm text-muted">({cards.length})</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
                {cards.map(({ name, identity }) => (
                  <figure key={name}>
                    <CardImage name={name} />
                    <figcaption className="mt-1.5 text-xs text-muted">
                      {name}
                      {key === "multi" ? (
                        <span className="mt-1 block">
                          <ColorPips identity={identity} />
                        </span>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
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
          imediata) e sinais adicionais de alto impacto, como{" "}
          {signals.map((key) => SIGNAL_LABELS[key] ?? key).join(", ")} — cada
          um define o piso da estimativa de forma independente (ver "Como o
          cálculo funciona" acima), não são pontos somados.
        </p>
        <p className="mt-3 text-justify text-muted">
          Pra decidir o quão forte é um combo encontrado, usamos primeiro a{" "}
          <strong className="text-fg">bracket tag</strong> que o próprio
          Commander Spellbook atribui a cada combo (Ruthless, Powerful, Spicy,
          Oddball, Core, Exhibition ou Banned — não confundir com os nomes dos
          5 brackets do deck, apesar de dois deles coincidirem). Quando o
          combo não tem essa classificação, caímos num heurístico próprio:
          combo de duas cartas em que ambas custam até 3 de mana já conta como
          rápido/barato.
        </p>

        <div className="mt-4 space-y-3">
          {signals.map((key) => {
            const info = SIGNAL_DESCRIPTIONS[key];
            return (
              <Panel key={key}>
                <h3 className="font-medium text-fg">
                  {SIGNAL_LABELS[key] ?? key}
                </h3>
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

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-fg">Fontes</h2>
        <p className="mt-3 text-justify text-muted">
          As informações desta página vêm das seguintes fontes oficiais e de
          terceiros:
        </p>
        <ul className="mt-4 space-y-3">
          {SOURCES.map(({ label, href, note }) => (
            <li key={href} className="text-sm">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-accent-secondary hover:underline"
              >
                {label}
              </a>
              <span className="block text-muted">{note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
