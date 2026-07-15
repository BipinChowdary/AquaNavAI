import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

from aquanavai.provenance import sha256_file


def test_committed_noaa_release_schema_and_checksums() -> None:
    root = Path(__file__).resolve().parents[3]
    scenario = root / "public" / "scenarios" / "south-florida-noaa-v1"
    manifest = json.loads((scenario / "manifest.json").read_text(encoding="utf-8"))
    schema = json.loads((root / "public" / "schemas" / "scenario.schema.json").read_text())
    Draft202012Validator(schema).validate(manifest)
    for filename, checksum in manifest["checksums"].items():
        assert sha256_file(scenario / filename) == checksum
    assert manifest["dataMode"] == "pinned-noaa"
    assert manifest["files"]["grid"] == "navigation-grid.json"
    catalog = yaml.safe_load((root / "data" / "catalog.yaml").read_text(encoding="utf-8"))
    for source in catalog["scenarios"]["south-florida-noaa-v1"]["sources"]:
        for filename, checksum in source.get("processedArtifactChecksums", {}).items():
            assert sha256_file(scenario / filename) == checksum
