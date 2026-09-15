/** Rodapé global: sobre o site, afiliação TCGRP, repositório e créditos de dados. */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-surface/60">
      <div className="mx-auto max-w-5xl space-y-3 px-6 py-8 text-sm text-muted">
        <p>
          <span className="font-semibold text-fg">Meus Brackets</span> é uma ferramenta da{" "}
          <a
            href="https://tcgrp.com.br"
            target="_blank"
            rel="noreferrer"
            className="text-accent-secondary hover:underline"
          >
            comunidade TCGRP
          </a>{" "}
          pra estimar o bracket de decks de Commander.
        </p>
        <p>
          Projeto{" "}
          <a
            href="https://github.com/johnywalves/mtg-bracket-analyzer"
            target="_blank"
            rel="noreferrer"
            className="text-accent-secondary hover:underline"
          >
            open source
          </a>
          , contribuições são bem-vindas. Inspirado no projeto original{" "}
          <a
            href="https://github.com/QuackQuackLabs/MTG-Analyzer"
            target="_blank"
            rel="noreferrer"
            className="text-accent-secondary hover:underline"
          >
            QuackQuackLabs/MTG-Analyzer
          </a>
          .
        </p>
        <p className="border-t border-white/10 pt-3 text-xs">
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
      </div>
    </footer>
  );
}
