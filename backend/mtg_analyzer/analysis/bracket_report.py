"""Human-readable Markdown report for a `BracketAssessment` (docs/spec/bracket-engine.md §34/§35).

JSON is the assessment model itself (already serializable via `service.to_jsonable`); this is the
one text formatter this change adds. HTML rendering (also in scope per the spec) is deferred — the
spec requires it consume the assessment, never re-derive bracket logic, and this same structure is
what an HTML renderer would walk.
"""

from __future__ import annotations

from mtg_analyzer.models.assessment import BracketAssessment, Deck, Signal

METHODOLOGY = (
    "This assessment is an automated estimate based on the selected Commander Brackets ruleset and "
    "additional analytical heuristics. It is not an official Wizards of the Coast classification. "
    "Official rules and project heuristics are shown separately above. It does not replace Rule Zero "
    "discussion with your pod."
)


def _deck_name(deck: Deck) -> str:
    return deck.name or "Unnamed deck"


def _commander_names(deck: Deck) -> str:
    names = [dc.card.name for dc in deck.commander]
    return ", ".join(names) if names else "(none)"


def _signal_section(title: str, signals: list[Signal]) -> list[str]:
    lines = [f"## {title}", ""]
    if not signals:
        lines.append("_None detected._")
        lines.append("")
        return lines
    for sig in signals:
        lines.append(f"- **{sig.category}** ({sig.strength}): {sig.explanation}")
    lines.append("")
    return lines


def render_markdown(assessment: BracketAssessment, deck: Deck, unresolved: list[str]) -> str:
    lines = [
        "# Commander Bracket Assessment",
        "",
        f"**Deck:** {_deck_name(deck)}  ",
        f"**Commander:** {_commander_names(deck)}",
        "",
        f"## Bracket {assessment.bracket} — {assessment.bracket_name}",
        "",
        f"Confidence: **{assessment.confidence.level.capitalize()}**  ",
        f"Likely range: {assessment.minimum_bracket}–{assessment.maximum_bracket}",
        "",
        "### Why?",
        "",
    ]
    if assessment.confidence.reasons:
        lines.extend(f"- {r}" for r in assessment.confidence.reasons)
    else:
        lines.append("- No specific rationale recorded.")
    lines.append("")

    lines.extend(_signal_section("Official Signals", assessment.official_signals))
    lines.extend(_signal_section("Heuristic Signals", assessment.heuristic_signals))

    lines.append("## Evidence")
    lines.append("")
    if assessment.evidence:
        for ev in assessment.evidence:
            cards = ", ".join(ev.card_or_cards)
            lines.append(f"- {ev.description} ({cards})")
    else:
        lines.append("_No supporting evidence recorded._")
    lines.append("")

    lines.append("## Warnings")
    lines.append("")
    all_warnings = list(assessment.warnings)
    if all_warnings or unresolved:
        for w in all_warnings:
            lines.append(f"- **{w.severity.upper()}** `{w.code}`: {w.message}")
        for name in unresolved:
            lines.append(f"- **WARNING** `UNRESOLVED_CARD`: could not resolve \"{name}\".")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Methodology")
    lines.append("")
    lines.append(METHODOLOGY)
    lines.append("")
    lines.append(
        f"_engine {assessment.engine_version} · rules {assessment.rules_version} · "
        f"data {assessment.data_version} · schema {assessment.schema_version}_"
    )

    return "\n".join(lines)
