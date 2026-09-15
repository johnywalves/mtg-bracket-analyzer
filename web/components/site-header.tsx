import Link from "next/link";

/** Header global — nome "Meus Brackets" + subtítulo de afiliação TCGRP, nav simples. */
export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-surface/60">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="block">
          <span className="text-xl font-bold tracking-tight text-fg">Meus Brackets</span>
          <p className="text-xs text-muted">Analista de Bracket da TCGRP</p>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/decks" className="text-muted hover:text-fg">
            Decks
          </Link>
          <Link href="/como-funciona" className="text-muted hover:text-fg">
            Como funciona
          </Link>
        </nav>
      </div>
    </header>
  );
}
