"use server";

import { analyzeDeck, MtgApiError } from "@/lib/api";
import type { AnalyzeResponse } from "@/lib/types";

export interface AnalyzeFormState {
  result: AnalyzeResponse | null;
  error: string | null;
}

export const INITIAL_ANALYZE_STATE: AnalyzeFormState = { result: null, error: null };

/** Server Action por trás do form de "colar deck" na home — mantém MTG_API_KEY no
 * servidor (lib/api.ts é `server-only`) e nunca expõe a chamada ao backend pro browser. */
export async function analyzeDeckAction(
  _prevState: AnalyzeFormState,
  formData: FormData,
): Promise<AnalyzeFormState> {
  const decklist = String(formData.get("decklist") ?? "").trim();
  if (!decklist) {
    return { result: null, error: "Cole sua decklist antes de analisar." };
  }

  try {
    const result = await analyzeDeck(decklist);
    return { result, error: null };
  } catch (cause) {
    return {
      result: null,
      error:
        cause instanceof MtgApiError
          ? cause.message
          : "Erro inesperado ao analisar o deck.",
    };
  }
}
