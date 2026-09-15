import type { AnalyzeResponse } from "@/lib/types";

export interface AnalyzeFormState {
  result: AnalyzeResponse | null;
  error: string | null;
}

export const INITIAL_ANALYZE_STATE: AnalyzeFormState = { result: null, error: null };
