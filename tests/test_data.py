from collections.abc import Iterator
from pathlib import Path

import pytest
from mtg_analyzer.data.db import CardDatabase
from mtg_analyzer.models.card import Card

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def db(tmp_path: Path) -> Iterator[CardDatabase]:
    database = CardDatabase(tmp_path / "test.db")
    database.ingest_cards(FIXTURES / "oracle_cards_sample.json")
    database.ingest_rulings(FIXTURES / "rulings_sample.json")
    yield database
    database.close()


def test_ingest_counts(db: CardDatabase) -> None:
    assert db.card_count() == 5  # incl. the art-series noise card + the flavor-name reskin


def test_get_by_name_extracts_fields(db: CardDatabase) -> None:
    sol = db.get_by_name("sol ring")  # case-insensitive
    assert sol is not None
    assert sol.cmc == 1.0
    assert sol.is_commander_legal()
    assert sol.game_changer is True
    assert sol.usd_price() == 1.49
    assert sol.color_identity == []


def test_color_identity_key(db: CardDatabase) -> None:
    row = db.conn.execute("SELECT ci_key FROM cards WHERE name = 'Llanowar Elves'").fetchone()
    assert row["ci_key"] == "G"


def test_dfc_handling(db: CardDatabase) -> None:
    delver = db.get_by_name("Delver of Secrets // Insectile Aberration")
    assert delver is not None
    assert delver.is_multifaced
    # color identity / cmc trustworthy at top level even though text/mana are per-face
    assert delver.color_identity == ["U"]
    assert delver.cmc == 1.0
    text = delver.get_oracle_text()
    assert "look at the top card" in text
    assert "Flying" in text
    assert delver.get_mana_cost() == "{U} // "
    # image falls back to the front face
    assert delver.get_image("normal") == "https://cards.scryfall.io/normal/delver-front.jpg"


def test_front_name_resolution_prefers_gameplay(db: CardDatabase) -> None:
    # "Delver of Secrets" must resolve to the transform creature, not the
    # same-named art-series card (which is also present in the fixture).
    card = db.get_by_name("Delver of Secrets")
    assert card is not None
    assert card.layout == "transform"
    assert card.name == "Delver of Secrets // Insectile Aberration"


def test_search_deprioritizes_non_gameplay(db: CardDatabase) -> None:
    results = db.search_by_name("Delver of Secrets")
    # gameplay (transform) card ranks ahead of the art-series object
    assert results[0].layout == "transform"


def test_printings_table_populated(db: CardDatabase) -> None:
    row = db.conn.execute(
        "SELECT set_code, usd, image_normal FROM printings WHERE oracle_id = ?",
        ("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",),
    ).fetchone()
    assert row["set_code"] == "cmm"
    assert row["usd"] == 1.49


def test_search_by_name(db: CardDatabase) -> None:
    results = db.search_by_name("elves")
    assert [c.name for c in results] == ["Llanowar Elves"]


def test_rulings_join(db: CardDatabase) -> None:
    rulings = db.get_rulings("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    assert len(rulings) == 1
    assert rulings[0].source == "wotc"
    assert "colorless mana" in rulings[0].comment


def test_reingest_is_idempotent(db: CardDatabase) -> None:
    db.ingest_cards(FIXTURES / "oracle_cards_sample.json")  # second time
    assert db.card_count() == 5  # INSERT OR REPLACE, not duplicated


def test_back_face_name_resolves(db: CardDatabase) -> None:
    # "Insectile Aberration" is Delver's back face — must resolve to the same card.
    card = db.get_by_name("Insectile Aberration")
    assert card is not None
    assert card.name == "Delver of Secrets // Insectile Aberration"


def test_flavor_name_resolves(db: CardDatabase) -> None:
    # "Helm's Deep" is a Universes Beyond reskin of Shinka, the Bloodsoaked Keep.
    card = db.get_by_flavor_name("Helm's Deep")
    assert card is not None
    assert card.name == "Shinka, the Bloodsoaked Keep"
    assert db.get_by_flavor_name("no such reskin") is None


def test_pt_name_cache_roundtrip(db: CardDatabase) -> None:
    assert db.get_localized_name("Anel Solar") is None
    db.cache_localized_name("Anel Solar", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    assert db.get_localized_name("Anel Solar") == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    # normalized (case/whitespace-insensitive) and scoped per-language
    assert db.get_localized_name("  ANEL SOLAR  ") == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert db.get_localized_name("Anel Solar", lang="es") is None


def test_ingest_reads_jsonl_format(tmp_path: Path) -> None:
    """The current Scryfall bulk layout is JSONL (one object per line), not a single JSON
    array — ingest must read it (see `_stream_bulk_objects`)."""
    jsonl = tmp_path / "oracle_cards.jsonl"
    jsonl.write_text(
        '{"id": "x", "oracle_id": "oid-x", "name": "Giant Growth", "layout": "normal",'
        ' "cmc": 1.0, "color_identity": ["G"], "legalities": {"commander": "legal"}}\n'
        '{"id": "y", "oracle_id": "oid-y", "name": "Lightning Bolt", "layout": "normal",'
        ' "cmc": 1.0, "color_identity": ["R"], "legalities": {"commander": "legal"}}\n'
    )
    db = CardDatabase(tmp_path / "test.db")
    try:
        assert db.ingest_cards(jsonl) == 2
        assert db.get_by_name("Giant Growth") is not None
        assert db.get_by_name("Lightning Bolt") is not None
    finally:
        db.close()


def test_model_multiface_layout_without_faces() -> None:
    # A 'normal' card is never multifaced; a transform card with no faces isn't either.
    card = Card.model_validate({"id": "x", "name": "Plains", "layout": "normal"})
    assert not card.is_multifaced
    assert card.get_oracle_text() == ""
