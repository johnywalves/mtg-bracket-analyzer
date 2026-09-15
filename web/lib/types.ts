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

/**
 * Tipos espelhando backend/mtg_analyzer/models/assessment.py — o modelo do
 * Bracket Engine (docs/spec/bracket-engine.md), devolvido por POST /api/v1/analyze.
 * Deliberadamente separado do `DeckReport` acima (motor antigo, ainda usado
 * pelos decks mockados em /decks).
 */

export interface EvidenceSource {
  type: "official" | "heuristic" | "data";
  rules_version: string | null;
}

export interface Evidence {
  id: string;
  type: string;
  source: EvidenceSource;
  card_or_cards: string[];
  description: string;
  impact: "low" | "medium" | "high" | null;
}

export interface Signal {
  id: string;
  category: string;
  source_type: "official" | "heuristic" | "data";
  strength: "low" | "medium" | "high";
  evidence: Evidence[];
  explanation: string;
}

export interface Confidence {
  level: "low" | "medium" | "high";
  reasons: string[];
}

export interface AssessmentWarning {
  code: string;
  severity: "warning" | "error";
  message: string;
}

export interface BracketAssessment {
  schema_version: string;
  engine_version: string;
  rules_version: string;
  data_version: string;
  bracket: number;
  bracket_name: string;
  minimum_bracket: number;
  maximum_bracket: number;
  confidence: Confidence;
  official_signals: Signal[];
  heuristic_signals: Signal[];
  evidence: Evidence[];
  warnings: AssessmentWarning[];
}

/** Corpo de resposta de POST /api/v1/analyze (backend/mtg_analyzer/api/app.py). */
export interface AnalyzeResponse {
  assessment: BracketAssessment;
  report_markdown: string;
  unresolved: string[];
  warnings: string[];
}
