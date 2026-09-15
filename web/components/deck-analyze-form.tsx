"use client";

import { useActionState } from "react";

import { analyzeDeckAction } from "@/app/actions";
import { INITIAL_ANALYZE_STATE, type AnalyzeFormState } from "@/app/analyze-form-state";
import { BracketBadge } from "@/components/bracket-badge";
import { Panel } from "@/components/panel";
import type { AnalyzeResponse, Signal } from "@/lib/types";

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

/** Form de "cole sua decklist" logo abaixo do HeroBrand — chama POST /api/v1/analyze
 * (via Server Action, ver app/actions.ts) e renderiza o BracketAssessment devolvido.
 * Com `offline`, cobre o form com um overlay de "backend indisponível". */
export function DeckAnalyzeForm({ offline = false }: { offline?: boolean }) {
  const [state, formAction, pending] = useActionState<AnalyzeFormState, FormData>(
    analyzeDeckAction,
    INITIAL_ANALYZE_STATE,
  );

  return (
    <Panel className="relative">
      <form action={formAction} className="flex flex-col gap-3" inert={offline}>
        <label htmlFor="decklist" className="text-sm font-medium text-fg">
          Cole sua decklist
        </label>
        <textarea
          id="decklist"
          name="decklist"
          rows={10}
          placeholder={"1 Sol Ring\n1 Sauron, the Dark Lord\n1 Cyclonic Rift\n..."}
          className="w-full rounded-lg border border-white/20 bg-bg p-3 text-sm text-fg placeholder:text-muted focus:border-accent-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || offline}
          className="self-start rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-medium text-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Analisando..." : "Analisar deck"}
        </button>
      </form>

      {offline ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-bg/80 backdrop-blur-sm">
          <p className="text-sm font-medium text-fg">Backend indisponível</p>
          <p className="text-xs text-muted">Tente novamente em instantes.</p>
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-4 rounded-lg border border-accent-primary/40 bg-accent-primary/10 p-3 text-sm text-fg">
          {state.error}
        </p>
      ) : null}

      {state.result ? <AnalyzeResult response={state.result} /> : null}
    </Panel>
  );
}

function AnalyzeResult({ response }: { response: AnalyzeResponse }) {
  const { assessment, unresolved, warnings } = response;

  return (
    <div className="mt-6 flex flex-col gap-5 border-t border-white/10 pt-6">
      <div className="flex flex-wrap items-center gap-4">
        <BracketBadge tier={assessment.bracket} size="lg" />
        <div>
          <p className="text-sm text-muted">
            Faixa provável: {assessment.minimum_bracket}–{assessment.maximum_bracket} ·
            Confiança:{" "}
            <span className="font-medium text-fg">
              {CONFIDENCE_LABEL[assessment.confidence.level] ?? assessment.confidence.level}
            </span>
          </p>
          {assessment.confidence.reasons.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-xs text-muted">
              {assessment.confidence.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <SignalList title="Sinais oficiais" signals={assessment.official_signals} />
      <SignalList title="Sinais heurísticos" signals={assessment.heuristic_signals} />

      {assessment.warnings.length > 0 || unresolved.length > 0 || warnings.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-fg">Avisos</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {assessment.warnings.map((w) => (
              <li
                key={w.code}
                className="rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-fg"
              >
                <span className="mr-1.5 text-xs font-semibold uppercase text-accent-primary">
                  {w.severity}
                </span>
                {w.message}
              </li>
            ))}
            {unresolved.map((name) => (
              <li
                key={name}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-muted"
              >
                Não encontramos &quot;{name}&quot; no banco local — carta excluída da análise.
              </li>
            ))}
            {warnings.map((note, i) => (
              <li key={i} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        engine {assessment.engine_version} · regras {assessment.rules_version} · dados{" "}
        {assessment.data_version}
      </p>
    </div>
  );
}

function SignalList({ title, signals }: { title: string; signals: Signal[] }) {
  if (signals.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
        {signals.map((signal) => (
          <li key={signal.id}>
            <span className="font-medium text-fg">{signal.category}</span> ({signal.strength}):{" "}
            {signal.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}
