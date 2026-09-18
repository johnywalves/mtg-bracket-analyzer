import type { AnalyzeResponse, Confidence, Evidence, Signal } from "@/lib/types";
import { translateString } from "@/lib/i18n/templates";

/**
 * Traduz pra PT-BR só o texto livre de uma `AnalyzeResponse` — nunca os campos
 * "enum-like" (category/source_type/severity/code/bracket_name), nem nomes de
 * carta (`unresolved`, `card_or_cards`). O backend (`bracket_service.py` /
 * `analysis/*.py`) fica 100% em inglês; ver o comentário no topo de `templates.ts`.
 *
 * `strength` segue enum-like no dado, mas é traduzido na hora de renderizar na UI
 * (ver `STRENGTH_PT` em `templates.ts`, usado por `deck-analyze-form.tsx`).
 *
 * Pura: devolve uma cópia, não muta `response`.
 */
export function translateAnalysis(response: AnalyzeResponse): AnalyzeResponse {
  return {
    ...response,
    assessment: {
      ...response.assessment,
      confidence: translateConfidence(response.assessment.confidence),
      official_signals: response.assessment.official_signals.map(translateSignal),
      heuristic_signals: response.assessment.heuristic_signals.map(translateSignal),
      evidence: response.assessment.evidence.map(translateEvidence),
      warnings: response.assessment.warnings.map((w) => ({
        ...w,
        message: translateString(w.message),
      })),
    },
    // `unresolved` (nomes de carta) fica intocado de propósito.
    warnings: response.warnings.map(translateString),
  };
}

function translateConfidence(confidence: Confidence): Confidence {
  return { ...confidence, reasons: confidence.reasons.map(translateString) };
}

function translateSignal(signal: Signal): Signal {
  return {
    ...signal,
    explanation: translateString(signal.explanation),
    evidence: signal.evidence.map(translateEvidence),
  };
}

function translateEvidence(evidence: Evidence): Evidence {
  return { ...evidence, description: translateString(evidence.description) };
}
