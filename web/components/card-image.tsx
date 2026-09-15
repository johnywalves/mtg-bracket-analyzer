"use client";

import { useState } from "react";

// Hotlink oficial do Scryfall (permitido pela Fan Content Policy). Versão
// "normal" sempre, nunca art_crop/border_crop, que cortam a linha de
// copyright/artista (proibido pelo CLAUDE.md da raiz).
function scryfallImageUrl(name: string): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
}

/** Modal de tela cheia compartilhado por CardImage e CardNameLink. */
function CardPreviewDialog({ name, src, onClose }: { name: string; src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/90 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- mesmo hotlink, tamanho maior */}
      <img src={src} alt={name} className="max-h-full max-w-full rounded-xl" />
    </div>
  );
}

export function CardImage({ name, className }: { name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const src = scryfallImageUrl(name);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in text-left"
        aria-label={`Ver ${name} em tela cheia`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- hotlink pontual, não vale configurar remotePatterns */}
        <img
          src={src}
          alt={name}
          loading="lazy"
          className={`aspect-[5/7] w-full rounded-lg border border-white/15 object-cover ${className ?? ""}`}
        />
      </button>

      {open ? <CardPreviewDialog name={name} src={src} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Menção de carta dentro de texto corrido (regras, explicações de sinais
 * etc.) — mesma ideia de clique-pra-ver da grade de Game Changers, só que
 * como um link inline em vez de uma figura em bloco.
 */
export function CardNameLink({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const src = scryfallImageUrl(name);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-zoom-in text-accent-secondary underline decoration-dotted underline-offset-2 hover:decoration-solid"
        aria-label={`Ver ${name} em tela cheia`}
      >
        {name}
      </button>

      {open ? <CardPreviewDialog name={name} src={src} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
