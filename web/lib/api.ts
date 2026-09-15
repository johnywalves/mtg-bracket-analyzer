import "server-only";

import type { AnalyzeResponse } from "@/lib/types";

/**
 * Client server-only para a API FastAPI do MTG Analyzer.
 *
 * O `import "server-only"` acima faz o build falhar se este módulo for
 * importado por um Client Component — é o que garante que `MTG_API_KEY`
 * nunca vaza pro bundle do browser. Toda chamada ao backend deve passar
 * por `mtgFetch`, nunca por `fetch` direto num Client Component.
 */

const API_URL = process.env.MTG_API_URL ?? "http://localhost:8000";
const API_KEY = process.env.MTG_API_KEY;

export class MtgApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MtgApiError";
  }
}

/** Faz uma requisição autenticada ao backend FastAPI, a partir do servidor Next.js. */
export async function mtgFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (API_KEY) {
    headers.set("X-API-Key", API_KEY);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      // Dashboard local: dados sempre atuais, sem cache de dados entre requisições.
      cache: "no-store",
    });
  } catch (cause) {
    throw new MtgApiError(
      `Não foi possível conectar ao backend em ${API_URL}${path}`,
    );
  }

  if (!res.ok) {
    throw new MtgApiError(`Backend respondeu ${res.status} para ${path}`, res.status);
  }

  return (await res.json()) as T;
}

export interface HealthStatus {
  status: string;
  version: string;
}

export function getHealth(): Promise<HealthStatus> {
  return mtgFetch<HealthStatus>("/health");
}

/** POST /api/v1/analyze — decklist colada → BracketAssessment + relatório Markdown. */
export function analyzeDeck(decklist: string, name?: string): Promise<AnalyzeResponse> {
  return mtgFetch<AnalyzeResponse>("/api/v1/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decklist, name: name ?? null }),
  });
}
