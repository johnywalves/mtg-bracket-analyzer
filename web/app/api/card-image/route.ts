import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

/**
 * Proxy + cache de imagens do Scryfall.
 *
 * `CardImage`/`CardNameLink` chamavam `api.scryfall.com` direto do browser em cada
 * `<img>` — uma grade de deck renderiza 60-100 de uma vez, e sob essa rajada de
 * requisições paralelas várias se perdem (Scryfall aplica rate limit por IP; ver
 * skill `scryfall-api`: "Cache images locally rather than hotlinking at scale").
 *
 * Aqui a primeira requisição por carta busca no Scryfall (com User-Agent/Accept
 * corretos, golden rule 4 do CLAUDE.md) e grava os bytes em disco; toda requisição
 * seguinte é servida direto do cache, sem nunca voltar pro Scryfall.
 */

const USER_AGENT = "MTGAnalyzer/0.1 (jacob@quackquacklabs.com)";

// Configurável (ex.: apontar pra um volume montado em produção); por padrão fica
// dentro do projeto, ao lado de .next — mesma pasta sobrevive a `next start`
// entre requisições, só não sobrevive a um rebuild de imagem sem volume.
const CACHE_DIR = process.env.CARD_IMAGE_CACHE_DIR ?? path.join(process.cwd(), ".cache", "card-images");

// Evita disparar duas buscas simultâneas pra mesma carta (duas abas abrindo o
// mesmo deck ao mesmo tempo, por exemplo) — a segunda espera a primeira terminar
// de gravar em disco em vez de duplicar a chamada ao Scryfall.
const inFlight = new Map<string, Promise<{ data: Buffer; contentType: string }>>();

class CardImageError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CardImageError";
  }
}

function cacheKeyFor(name: string): string {
  return createHash("sha256").update(name.trim().toLowerCase()).digest("hex");
}

// `Buffer` não satisfaz o `BodyInit` da lib DOM usada aqui (o `ArrayBufferLike`
// genérico do @types/node não encaixa em `ArrayBuffer`), embora funcione em
// runtime — copia pra um `ArrayBuffer` "puro" antes de devolver na `Response`.
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

async function readFromCache(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const data = await readFile(path.join(CACHE_DIR, `${key}.jpg`));
    return { data, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

async function fetchAndCache(name: string, key: string): Promise<{ data: Buffer; contentType: string }> {
  const upstream = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`,
    {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      // O cache é o nosso: nada de cache HTTP intermediário guardando/soltando isso.
      cache: "no-store",
    },
  );

  if (!upstream.ok) {
    throw new CardImageError(upstream.status, `Scryfall respondeu ${upstream.status} para "${name}"`);
  }

  const data = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${key}.jpg`), data);

  return { data, contentType };
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name || !name.trim()) {
    return new Response("Missing `name` query param.", { status: 400 });
  }

  const key = cacheKeyFor(name);

  const cached = await readFromCache(key);
  if (cached) {
    return new Response(toArrayBuffer(cached.data), {
      headers: {
        "Content-Type": cached.contentType,
        // Uma vez em cache, a arte de uma carta não muda mais — pode cachear
        // pesado no browser também.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchAndCache(name, key).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    const { data, contentType } = await pending;
    return new Response(toArrayBuffer(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (cause) {
    const status = cause instanceof CardImageError ? cause.status : 502;
    const message = cause instanceof Error ? cause.message : "Falha ao buscar imagem no Scryfall.";
    return new Response(message, { status });
  }
}
