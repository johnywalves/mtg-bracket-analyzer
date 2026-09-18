/**
 * Nome amigável em PT-BR pra cada `category` de sinal que o Bracket Engine devolve
 * (backend/mtg_analyzer/analysis/bracket_signals.py, engine.py) — usado só pra exibição
 * na UI de análise (ver `deck-analyze-form.tsx`). `category` chega em inglês do backend;
 * uma categoria sem entrada aqui cai no fallback do próprio `category` cru.
 */
export const SIGNAL_CATEGORY_LABEL_PT: Record<string, string> = {
  GAME_CHANGER: "Game Changers",
  FAST_MANA: "Mana rápida",
  TUTOR: "Tutores",
  INTERACTION: "Interação",
  DECK_SPEED: "Velocidade do deck",
  COMBO: "Combos",
  TWO_CARD_COMBO: "Combo de duas peças",
  MULTI_CARD_COMBO: "Combo de múltiplas peças",
  EXTRA_TURN: "Turnos extras",
  MASS_LAND_DENIAL: "Negação massiva de terrenos",
};
