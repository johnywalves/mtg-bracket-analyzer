/**
 * Tipos TS espelhando os modelos Pydantic do backend
 * (backend/mtg_analyzer/models/analysis.py). Mantidos em sincronia manualmente
 * até existir geração automática de schema — nomes e formatos de campo iguais
 * aos do lado Python, de propósito.
 */

export interface Validation {
  legal: boolean;
  card_count: number;
  commander_identity: string; // ex.: "BGUW" ("C" se incolor)
  issues: string[];
  warnings: string[];
}

export interface CategoryCount {
  category: string;
  count: number;
  target: number;
  gap: number; // max(0, target - count)
}

export interface CurveBucket {
  cmc: number; // 7 significa "7+"
  count: number;
}

export interface DeckReport {
  name: string | null;
  commanders: string[];
  identity: string;
  validation: Validation;
  categories: CategoryCount[];
  curve: CurveBucket[];
  game_changers: string[];
  combos: string[];
  bracket_estimate: number; // 1–5
  bracket_rationale: string;
}

/** Resumo usado na listagem (equivalente ao que GET /decks devolverá). */
export interface DeckSummary {
  slug: string;
  name: string;
  commanders: string[];
  identity: string;
  bracket_estimate: number;
  legal: boolean;
}
