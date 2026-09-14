# Assessment Schema

**Status:** Draft  
**Specification Version:** 0.1.0  
**Language:** Python 3.11+ / Pydantic

## 1. Core Domain Models

```python
from pydantic import BaseModel, Field
from typing import Literal

class Card(BaseModel):
    name: str
    oracle_id: str
    mana_cost: str | None
    mana_value: float
    type_line: str
    oracle_text: str
    colors: list[str]
    color_identity: list[str]

class DeckCard(BaseModel):
    card: Card
    quantity: int
    category: str | None
    is_commander: bool = False
    is_companion: bool = False

class DeckSource(BaseModel):
    type: Literal["moxfield", "text", "manual"]
    id: str | None

class Deck(BaseModel):
    name: str | None
    commander: list[DeckCard]
    cards: list[DeckCard]
    companion: DeckCard | None
    source: DeckSource
```

## 2. Assessment Models

```python
class EvidenceSource(BaseModel):
    type: Literal["official", "heuristic", "data"]
    rules_version: str | None = None

class Evidence(BaseModel):
    id: str
    type: str
    source: EvidenceSource
    card_or_cards: list[str]
    description: str
    impact: Literal["low", "medium", "high"] | None = None

class Signal(BaseModel):
    id: str
    category: str
    source_type: Literal["official", "heuristic", "data"]
    strength: Literal["low", "medium", "high"]
    evidence: list[Evidence]
    explanation: str

class Confidence(BaseModel):
    level: Literal["low", "medium", "high"]
    reasons: list[str]

class AssessmentWarning(BaseModel):
    code: str
    severity: Literal["warning", "error"]
    message: str

class BracketAssessment(BaseModel):
    schema_version: str = Field(default="1.0")
    engine_version: str
    rules_version: str
    data_version: str
    
    bracket: int
    bracket_name: str
    minimum_bracket: int
    maximum_bracket: int
    confidence: Confidence
    
    official_signals: list[Signal]
    heuristic_signals: list[Signal]
    evidence: list[Evidence]
    warnings: list[AssessmentWarning]
```
