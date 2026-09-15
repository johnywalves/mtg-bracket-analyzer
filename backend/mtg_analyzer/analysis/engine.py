import yaml  # type: ignore[import-untyped]  # pyyaml stubs not declared in pyproject (upstream-owned)
from pathlib import Path
from mtg_analyzer.models.assessment import (
    Deck, BracketAssessment, Signal, Evidence, EvidenceSource, Confidence, AssessmentWarning
)

DEFAULT_RULES_DIR = Path(__file__).resolve().parent.parent / "rules" / "commander"

class Ruleset:
    def __init__(self, data: dict):
        self.version = data.get("version", "unknown")
        self.brackets = data.get("brackets", {})

        self.game_changers_by_id = {}
        self.game_changers_by_name = set()

        for gc in data.get("game_changers", []):
            if gc.get("oracle_id"):
                self.game_changers_by_id[gc["oracle_id"]] = gc.get("name", "")
            if gc.get("name"):
                self.game_changers_by_name.add(gc["name"])

        self.signals = data.get("signals", {})

    @classmethod
    def load(cls, filepath: str | Path) -> "Ruleset":
        with open(filepath, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls(data)


def load_latest_ruleset(rules_dir: Path | None = None) -> Ruleset:
    """Load the most recent versioned ruleset (filenames are `YYYY-MM.yaml`, so lexicographic
    order is chronological order). Rules are data, never hard-coded — see docs/spec/bracket-engine.md
    §10 and CLAUDE.md's "treat the Game Changers list as external, versioned data" rule."""
    directory = rules_dir or DEFAULT_RULES_DIR
    files = sorted(directory.glob("*.yaml"))
    if not files:
        raise FileNotFoundError(f"No ruleset files found in {directory}")
    return Ruleset.load(files[-1])

class AnalysisContext:
    def __init__(self, ruleset: Ruleset, data_version: str, engine_version: str = "0.1.0"):
        self.ruleset = ruleset
        self.data_version = data_version
        self.engine_version = engine_version

class BracketEngine:
    def __init__(self, context: AnalysisContext):
        self.context = context

    def analyze(self, deck: Deck) -> BracketAssessment:
        warnings = self._validate(deck)

        official_signals = self._extract_official_signals(deck)
        heuristic_signals = self._extract_heuristic_signals(deck)

        all_evidence = []
        for sig in official_signals + heuristic_signals:
            all_evidence.extend(sig.evidence)

        bracket, min_b, max_b = self._classify(official_signals, heuristic_signals)
        bracket_name = self.context.ruleset.brackets.get(bracket, {}).get("name", f"Bracket {bracket}")

        confidence = self._estimate_confidence(deck, warnings)

        return BracketAssessment(
            engine_version=self.context.engine_version,
            rules_version=self.context.ruleset.version,
            data_version=self.context.data_version,
            bracket=bracket,
            bracket_name=bracket_name,
            minimum_bracket=min_b,
            maximum_bracket=max_b,
            confidence=confidence,
            official_signals=official_signals,
            heuristic_signals=heuristic_signals,
            evidence=all_evidence,
            warnings=warnings
        )

    def _validate(self, deck: Deck) -> list[AssessmentWarning]:
        warnings = []
        # Basic validation
        if not deck.commander:
            warnings.append(AssessmentWarning(
                code="MISSING_COMMANDER",
                severity="error",
                message="Deck has no commander specified."
            ))

        card_count = sum(c.quantity for c in deck.cards) + sum(c.quantity for c in deck.commander)
        if deck.companion:
            card_count += deck.companion.quantity

        if card_count != 100:
            warnings.append(AssessmentWarning(
                code="INVALID_DECK_SIZE",
                severity="warning",
                message=f"Deck contains {card_count} cards instead of 100."
            ))

        return warnings

    def _extract_official_signals(self, deck: Deck) -> list[Signal]:
        signals = []
        gc_evidence = []

        for deck_card in deck.cards + deck.commander:
            # Check by oracle_id first, fallback to name
            is_gc = False
            if deck_card.card.oracle_id in self.context.ruleset.game_changers_by_id:
                is_gc = True
            elif deck_card.card.name in self.context.ruleset.game_changers_by_name:
                is_gc = True

            if is_gc:
                gc_evidence.append(Evidence(
                    id=f"ev-gc-{deck_card.card.oracle_id or deck_card.card.name}",
                    type="game_changer",
                    source=EvidenceSource(type="official", rules_version=self.context.ruleset.version),
                    card_or_cards=[deck_card.card.name],
                    description=f"{deck_card.card.name} is listed as a Game Changer.",
                    impact="high"
                ))

        if gc_evidence:
            signals.append(Signal(
                id="sig-official-gc",
                category="GAME_CHANGER",
                source_type="official",
                strength="high",
                evidence=gc_evidence,
                explanation=f"Found {len(gc_evidence)} Game Changer(s)."
            ))

        return signals

    def _extract_heuristic_signals(self, deck: Deck) -> list[Signal]:
        # Minimal heuristics placeholder
        return []

    def _classify(self, official: list[Signal], heuristic: list[Signal]) -> tuple[int, int, int]:
        # Very basic placeholder logic
        # Rule of thumb: if Game Changers present, it's at least Bracket 4
        bracket = 2
        min_b = 2
        max_b = 3

        gc_count = sum(1 for s in official if s.category == "GAME_CHANGER")
        if gc_count > 0:
            bracket = 4
            min_b = 4
            max_b = 5

        return bracket, min_b, max_b

    def _estimate_confidence(self, deck: Deck, warnings: list[AssessmentWarning]) -> Confidence:
        if any(w.severity == "error" for w in warnings):
            return Confidence(level="low", reasons=["Critical errors in validation."])
        if any(w.severity == "warning" for w in warnings):
            return Confidence(level="medium", reasons=["Warnings present during validation."])

        return Confidence(level="high", reasons=["Deck is fully valid and resolved."])
