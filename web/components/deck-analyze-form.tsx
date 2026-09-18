"use client";

import { useActionState } from "react";

import { analyzeDeckAction } from "@/app/actions";
import {
  INITIAL_ANALYZE_STATE,
  type AnalyzeFormState,
} from "@/app/analyze-form-state";
import { BracketBadge } from "@/components/bracket-badge";
import { CardImage } from "@/components/card-image";
import { Panel } from "@/components/panel";
import { SIGNAL_CATEGORY_LABEL_PT } from "@/lib/rules/signal-labels";
import { STRENGTH_PT } from "@/lib/i18n/templates";
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
  const [state, formAction, pending] = useActionState<
    AnalyzeFormState,
    FormData
  >(analyzeDeckAction, INITIAL_ANALYZE_STATE);

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
          placeholder={
            "1 Sol Ring\n1 Sauron, the Dark Lord\n1 Cyclonic Rift\n..."
          }
          className="w-full rounded-lg border bg-bg p-3 text-sm placeholder:text-muted focus:border-accent-primary focus:outline-none"
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
      <div className="flex flex-row justify-between gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,160px)_1fr]">
          {assessment.commanders.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide">
                Comandante{assessment.commanders.length > 1 ? "s" : ""}
              </p>
              <div
                className={
                  assessment.commanders.length > 1
                    ? "grid grid-cols-2 gap-3"
                    : ""
                }
              >
                {assessment.commanders.map((name) => (
                  <CardImage key={name} name={name} className="w-full" />
                ))}
              </div>
            </div>
          ) : (
            <span></span>
          )}
        </div>
        <div className="flex flex-col gap-6 self-start">
          <BracketBadge tier={assessment.bracket} size="lg" />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Faixa provável: {assessment.minimum_bracket}–
              {assessment.maximum_bracket} · Confiança:{" "}
              <span className="font-medium text-fg">
                {CONFIDENCE_LABEL[assessment.confidence.level] ??
                  assessment.confidence.level}
              </span>
            </p>
            {assessment.confidence.reasons.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-muted">
                {assessment.confidence.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {[...assessment.official_signals, ...assessment.heuristic_signals].map(
          (signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ),
        )}
      </div>

      {assessment.warnings.length > 0 ||
      unresolved.length > 0 ||
      warnings.length > 0 ? (
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
                Não encontramos &quot;{name}&quot; no banco local — carta
                excluída da análise.
              </li>
            ))}
            {warnings.map((note, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-muted"
              >
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        engine {assessment.engine_version} · regras {assessment.rules_version} ·
        dados {assessment.data_version}
      </p>
    </div>
  );
}

const SIGNAL_LIST_STYLE: Record<
  "official" | "heuristic" | "data",
  { border: string; badge: string }
> = {
  official: {
    border: "border-accent-primary/40",
    badge: "border-accent-primary/50 bg-accent-primary/10 text-accent-primary",
  },
  heuristic: {
    border: "border-white/15",
    badge: "border-white/20 bg-white/5 text-muted",
  },
  data: {
    border: "border-accent-secondary/40",
    badge:
      "border-accent-secondary/50 bg-accent-secondary/10 text-accent-secondary",
  },
};

/** Extrai o id da variante do Commander Spellbook a partir do id de evidência
 * (`ev-combo-{combo.id}`, ver `bracket_signals.combo_signal` no backend), pra montar
 * o link "ver no Spellbook". */
function comboIdFromEvidenceId(evidenceId: string): string | null {
  const m = /^ev-combo-(.+)$/.exec(evidenceId);
  return m ? m[1] : null;
}

const COMBO_EVIDENCE_TYPES = new Set(["two_card_combo", "multi_card_combo"]);

/** Um sinal do bracket (GAME_CHANGER, FAST_MANA, TUTOR, INTERACTION, DECK_SPEED, ...):
 * nome amigável + explicação, e — quando o sinal tem cartas associadas — a grade de
 * imagens das cartas que contaram pra ele (mesmo padrão de `/como-funciona`: clique
 * na carta abre o preview em tela cheia via `CardImage`). DECK_SPEED é agregado (sem
 * `card_or_cards` por evidência), então não renderiza grade. Sinais de combo (fonte
 * "data") trocam a grade genérica por uma lista com link direto pra cada combo no
 * Commander Spellbook. */
function SignalCard({ signal }: { signal: Signal }) {
  const cardNames = [
    ...new Set(signal.evidence.flatMap((e) => e.card_or_cards)),
  ];
  const style =
    SIGNAL_LIST_STYLE[signal.source_type] ?? SIGNAL_LIST_STYLE.heuristic;
  const comboEvidence = signal.evidence.filter((e) =>
    COMBO_EVIDENCE_TYPES.has(e.type),
  );

  return (
    <div className="rounded-lg bg-bg p-3">
      <div className="flex flex-row justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-fg flex flex-row gap-2">
            {SIGNAL_CATEGORY_LABEL_PT[signal.category] ?? signal.category}
          </p>
          <p className="text-sm text-muted">
            <span className="text-fg">
              {STRENGTH_PT[signal.strength] ?? signal.strength}
            </span>
            : {signal.explanation}
          </p>
        </div>

        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium h-fit ${style.badge}`}
        >
          {signal.source_type === "official"
            ? "Regra oficial"
            : signal.source_type === "data"
              ? "Dados"
              : "Heurístico"}
        </span>
      </div>

      {comboEvidence.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {comboEvidence.map((e) => {
            const comboId = comboIdFromEvidenceId(e.id);
            return (
              <li
                key={e.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted"
              >
                <p className="text-fg">{e.card_or_cards.join(" + ")}</p>
                <p className="mt-0.5">{e.description}</p>
                {comboId ? (
                  <a
                    href={`https://commanderspellbook.com/combo/${comboId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-accent-primary hover:underline"
                  >
                    Ver no Commander Spellbook ↗
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : cardNames.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
          {cardNames.map((name) => (
            <CardImage key={name} name={name} className="w-full" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
