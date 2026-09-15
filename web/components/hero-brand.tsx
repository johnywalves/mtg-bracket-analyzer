import Image from "next/image";

/** Bloco de marca da primeira dobra da home: Capywitch entrando pela esquerda,
 * por trás do título/subtítulo (z-0 vs z-10), tudo centralizado na página. */
export function HeroBrand() {
  return (
    <div className="relative mx-auto flex w-fit flex-col">
      <Image
        src="/capywitch.png"
        alt=""
        aria-hidden="true"
        width={408}
        height={612}
        priority
        className="pointer-events-none absolute -left-4 top-1/2 z-0 w-20 -translate-y-1/2 select-none sm:-left-6 sm:w-28"
      />
      <div className="relative ml-18 z-10 flex flex-col">
        <h1 className="sticker-title mt-1 text-5xl sm:text-6xl">Meus Brackets</h1>
        <p className="mt-2 w-full text-xxl text-muted sm:text-xl">
          Analista de Bracket da TCGRP
        </p>
      </div>
    </div>
  );
}
