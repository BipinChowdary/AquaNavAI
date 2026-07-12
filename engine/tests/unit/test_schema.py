import json

from jsonschema import Draft202012Validator

from aquanavai.config import repository_root


def test_released_manifest_matches_public_json_schema() -> None:
    root = repository_root()
    schema = json.loads((root / "public/schemas/scenario.schema.json").read_text(encoding="utf-8"))
    manifest = json.loads(
        (root / "public/scenarios/south-florida-v1/manifest.json").read_text(encoding="utf-8")
    )
    errors = list(Draft202012Validator(schema).iter_errors(manifest))
    assert errors == []
