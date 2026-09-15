import Image from "next/image";
import Link from "next/link";

/** Header global — CapyWitch + nome "Meus Brackets" + subtítulo de afiliação TCGRP, nav simples. */
export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-surface/60">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/capywitch.png"
            alt=""
            aria-hidden="true"
            width={408}
            height={612}
            priority
            className="pointer-events-none h-10 w-auto select-none"
          />
          <span>
            <span className="block text-xl font-bold tracking-tight text-fg">Meus Brackets</span>
            <span className="block text-xs text-muted">Analista de Bracket da TCGRP</span>
          </span>
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
