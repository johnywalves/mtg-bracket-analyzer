import Image from "next/image";

/** Bloco de marca da primeira dobra da home: CapyWitch ao lado do título/subtítulo,
 * tudo centralizado na página. */
export function HeroBrand() {
  return (
    <div className="mx-auto flex w-fit items-center gap-0">
      <div className="relative w-28 shrink-0 sm:w-36">
        <Image
          src="/capywitch.png"
          alt=""
          aria-hidden="true"
          width={408}
          height={612}
          priority
          className="pointer-events-none z-0 relative h-auto w-full select-none"
        />
      </div>
      <div className="flex flex-col">
        <h1 className="sticker-title text-5xl font-bold sm:text-6xl">
          Meus Brackets
        </h1>
        <p className="mt-1 w-full text-lg text-muted font-light sm:text-2xl">
          Analista de Bracket da TCGRP
        </p>
      </div>
    </div>
  );
}
