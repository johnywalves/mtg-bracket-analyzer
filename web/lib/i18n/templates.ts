/**
 * Dicionário de tradução EN → PT-BR para as frases de texto livre que o backend do
 * Bracket Engine gera (backend/mtg_analyzer/analysis/bracket_signals.py, engine.py,
 * bracket_service.py). O backend em si fica 100% em inglês — a tradução acontece
 * só aqui, no lado do Next.js (ver `translate-analysis.ts`).
 *
 * Cada entrada casa uma regex contra a frase exata que o backend produz e reconstrói
 * a versão em português a partir dos grupos capturados (contagens, nomes de carta,
 * percentuais etc.). Uma frase que não casa com nenhuma entrada volta sem alteração
 * (inglês) — ver `translateString` — e um aviso é logado no console do servidor, pra
 * dar pra perceber quando os textos do backend mudarem e o dicionário ficar desatualizado.
 *
 * IMPORTANTE: ao alterar uma f-string em bracket_signals.py/engine.py/bracket_service.py,
 * atualize a entrada correspondente aqui também.
 */

export interface TranslationTemplate {
  /** Nome curto só pra facilitar achar a entrada nos logs de "sem tradução". */
  name: string;
  pattern: RegExp;
  render: (groups: string[]) => string;
}

const INTERACTION_KIND_PT: Record<string, string> = {
  removal: "remoção",
  "board wipe": "wipe de tabuleiro",
  counterspell: "contra-mágica",
  "graveyard hate": "hate de cemitério",
  protection: "proteção",
};

function translateInteractionSummary(summary: string): string {
  // "2 removal, 1 board wipe" -> "2 remoção, 1 wipe de tabuleiro"
  return summary
    .split(", ")
    .map((part) => {
      const m = /^(\d+) (.+)$/.exec(part);
      if (!m) return part;
      const [, count, kind] = m;
      return `${count} ${INTERACTION_KIND_PT[kind] ?? kind}`;
    })
    .join(", ");
}

const PRESENT_ABSENT_PT: Record<string, string> = { present: "presente", absent: "ausente" };
const SPEED_PT: Record<string, string> = { low: "baixa", medium: "média", high: "alta" };
const EXTRA_TURN_KIND_PT: Record<string, string> = {
  "repeatable/chainable": "repetível/encadeável",
  "one-shot spell": "feitiço único",
};
const TUTOR_KIND_PT: Record<string, string> = { narrow: "estreita", broad: "ampla" };

export const TEMPLATES: TranslationTemplate[] = [
  // --- bracket_signals.py: GAME_CHANGER -------------------------------------------------
  {
    name: "game_changer.explanation",
    pattern: /^Found (\d+) Game Changer\(s\)\.$/,
    render: ([n]) => `Encontrado(s) ${n} Game Changer(s).`,
  },
  {
    name: "game_changer.evidence",
    pattern: /^(.+) is listed as a Game Changer\.$/,
    render: ([name]) => `${name} está listado(a) como Game Changer.`,
  },

  // --- bracket_signals.py: COMBO ---------------------------------------------------------
  {
    name: "combo.evidence",
    pattern:
      /^(.+) form a combo \(([^)]*)\)((?: \(both pieces cheap\/early, mana value ≤ 3 — heuristic threshold\))?)\.$/,
    render: ([names, produces, cheapNote]) =>
      `${names} formam um combo (${produces})` +
      (cheapNote
        ? " (ambas as peças baratas/rápidas, valor de mana ≤ 3 — limiar heurístico)"
        : "") +
      ".",
  },
  {
    name: "combo.explanation",
    pattern:
      /^Found (\d+) complete combo\(s\) in the decklist \(offline combo cache\)\.( At least one is early\/cheap\.)?$/,
    render: ([n, cheapSuffix]) =>
      `Encontrado(s) ${n} combo(s) completo(s) na decklist (cache de combos offline).` +
      (cheapSuffix ? " Pelo menos um é barato/rápido." : ""),
  },

  // --- bracket_signals.py: EXTRA_TURN -----------------------------------------------------
  {
    name: "extra_turn.evidence",
    pattern: /^(.+) grants an extra turn \((repeatable\/chainable|one-shot spell)\)\.$/,
    render: ([name, kind]) => `${name} concede um turno extra (${EXTRA_TURN_KIND_PT[kind] ?? kind}).`,
  },
  {
    name: "extra_turn.explanation",
    pattern: /^Found (\d+) extra-turn effect\(s\)(, including repeatable\/chainable ones\.|\.)$/,
    render: ([n, suffix]) =>
      `Encontrado(s) ${n} efeito(s) de turno extra` +
      (suffix.startsWith(",") ? ", incluindo efeitos repetíveis/encadeáveis." : "."),
  },

  // --- bracket_signals.py: MASS_LAND_DENIAL -----------------------------------------------
  {
    name: "mld.evidence",
    pattern: /^(.+) symmetrically denies\/destroys multiple players' lands\.$/,
    render: ([name]) => `${name} nega/destrói simetricamente terrenos de múltiplos jogadores.`,
  },
  {
    name: "mld.explanation",
    pattern:
      /^Found (\d+) mass land denial effect\(s\) \(symmetric, non-replacing — single-target land removal doesn't count\)\.$/,
    render: ([n]) =>
      `Encontrado(s) ${n} efeito(s) de negação massiva de terrenos ` +
      "(simétrico, não substitutivo — remoção de terreno único não conta).",
  },

  // --- bracket_signals.py: FAST_MANA ------------------------------------------------------
  {
    name: "fast_mana.evidence",
    pattern: /^(.+) is a curated fast-mana staple\.$/,
    render: ([name]) => `${name} é um staple de mana rápida curado.`,
  },
  {
    name: "fast_mana.explanation",
    pattern:
      /^(\d+) fast-mana card\(s\), (\d+)% of nonland cards \(heuristic only — does not by itself set the bracket\)\.$/,
    render: ([n, pct]) =>
      `${n} carta(s) de mana rápida, ${pct}% das cartas não-terreno ` +
      "(apenas heurístico — não define o bracket sozinho).",
  },

  // --- bracket_signals.py: TUTOR -----------------------------------------------------------
  {
    name: "tutor.evidence",
    pattern: /^(.+) tutors for a card \((narrow|broad)\)\.$/,
    render: ([name, kind]) => `${name} busca uma carta (${TUTOR_KIND_PT[kind] ?? kind}).`,
  },
  {
    name: "tutor.explanation",
    pattern:
      /^(\d+) tutor\(s\) \((\d+) broad, (\d+) narrow\), (\d+)% density\. Tutors are consistency\/heuristic signal only — no longer bracket-restricting per the Oct 2025 rules update\.$/,
    render: ([n, broad, narrow, pct]) =>
      `${n} tutor(es) (${broad} amplo(s), ${narrow} estreito(s)), densidade de ${pct}%. ` +
      "Tutores são sinal de consistência/heurístico apenas — não restringem mais o bracket " +
      "desde a atualização de regras de out/2025.",
  },

  // --- bracket_signals.py: INTERACTION -----------------------------------------------------
  {
    name: "interaction.evidence",
    pattern: /^(.+) provides (removal|board wipe|counterspell|graveyard hate|protection)\.$/,
    render: ([name, kind]) => `${name} fornece ${INTERACTION_KIND_PT[kind] ?? kind}.`,
  },
  {
    name: "interaction.explanation",
    pattern: /^(\d+) interaction piece\(s\) \((.+)\), (\d+)% density\.$/,
    render: ([n, summary, pct]) =>
      `${n} peça(s) de interação (${translateInteractionSummary(summary)}), densidade de ${pct}%.`,
  },

  // --- bracket_signals.py: DECK_SPEED ------------------------------------------------------
  {
    name: "deck_speed.evidence",
    pattern:
      /^Average nonland mana value ([\d.]+), (\d+) fast-mana card\(s\), tutor density (\d+)%, combo (present|absent) → (low|medium|high) deck speed\.$/,
    render: ([avg, n, pct, presentAbsent, speed]) =>
      `Valor de mana médio (não-terreno) ${avg}, ${n} carta(s) de mana rápida, ` +
      `densidade de tutores ${pct}%, combo ${PRESENT_ABSENT_PT[presentAbsent] ?? presentAbsent} ` +
      `→ velocidade de deck ${SPEED_PT[speed] ?? speed}.`,
  },
  {
    name: "deck_speed.explanation",
    pattern: /^Estimated deck speed: (low|medium|high)\.$/,
    render: ([speed]) => `Velocidade de deck estimada: ${SPEED_PT[speed] ?? speed}.`,
  },

  // --- engine.py: validation warnings -------------------------------------------------------
  {
    name: "warning.missing_commander",
    pattern: /^Deck has no commander specified\.$/,
    render: () => "Deck não tem comandante especificado.",
  },
  {
    name: "warning.invalid_deck_size",
    pattern: /^Deck contains (\d+) cards instead of 100\.$/,
    render: ([n]) => `Deck contém ${n} carta(s) em vez de 100.`,
  },

  // --- engine.py: confidence reasons --------------------------------------------------------
  {
    name: "confidence.critical_errors",
    pattern: /^Critical errors in validation\.$/,
    render: () => "Erros críticos na validação.",
  },
  {
    name: "confidence.warnings_present",
    pattern: /^Warnings present during validation\.$/,
    render: () => "Avisos presentes durante a validação.",
  },
  {
    name: "confidence.incomplete_combo_data",
    pattern:
      /^No combo data available — TWO_CARD_COMBO signal skipped \(INCOMPLETE_COMBO_DATA\)\.$/,
    render: () =>
      "Dados de combo indisponíveis — sinal TWO_CARD_COMBO ignorado (INCOMPLETE_COMBO_DATA).",
  },
  {
    name: "confidence.fully_valid",
    pattern: /^Deck is fully valid and resolved\.$/,
    render: () => "Deck totalmente válido e resolvido.",
  },

  // --- bracket_service.py: top-level notes --------------------------------------------------
  {
    name: "note.live_backfill_unavailable",
    pattern: /^Live Scryfall backfill unavailable — (.+) \(offline or rate-limited\); skipped\.$/,
    render: ([excType]) =>
      `Preenchimento ao vivo via Scryfall indisponível — ${excType} (offline ou limite de ` +
      "taxa); ignorado.",
  },
  {
    name: "note.filled_live",
    pattern: /^Filled (\d+) card\(s\) live from Scryfall \(not yet in the local bulk snapshot\)\.$/,
    render: ([n]) =>
      `Preenchida(s) ${n} carta(s) ao vivo via Scryfall (ainda não presente(s) no snapshot local).`,
  },
  {
    name: "note.unresolved_excluded",
    pattern:
      /^Bracket analysis: (\d+) card\(s\) could not be resolved and were excluded from the assessment\.$/,
    render: ([n]) =>
      `Análise de bracket: ${n} carta(s) não pôde(ram) ser resolvida(s) e foi(ram) excluída(s) ` +
      "da avaliação.",
  },
  {
    name: "note.live_fallback_capped",
    pattern:
      /^(\d+) more unresolved card\(s\) skipped the individual live-resolution fallback \(cap: (\d+) per request\)\.$/,
    render: ([n, cap]) =>
      `${n} carta(s) não resolvida(s) adicional(is) não passou(passaram) pelo fallback de ` +
      `resolução individual ao vivo (limite: ${cap} por requisição).`,
  },
];

/** Traduz uma frase via a tabela acima; sem correspondência, devolve o original em inglês
 * e loga um aviso no console do servidor (não quebra a página — ver doc do módulo). */
export function translateString(text: string): string {
  for (const template of TEMPLATES) {
    const match = template.pattern.exec(text);
    if (match) {
      return template.render(match.slice(1));
    }
  }
  console.warn(`[i18n] Sem tradução para: ${JSON.stringify(text)}`);
  return text;
}
