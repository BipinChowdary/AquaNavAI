from aquanavai.config import load_scenario, load_vehicle
from aquanavai.export.web import export_web_scenario
from aquanavai.provenance import sha256_file


def test_offline_export_is_checksum_reproducible(tmp_path) -> None:
    first = export_web_scenario(load_scenario("south-florida-v1"), load_vehicle(), tmp_path / "one")
    second = export_web_scenario(
        load_scenario("south-florida-v1"), load_vehicle(), tmp_path / "two"
    )
    for filename in ("bathymetry.webp", "routes.geojson", "metrics.json", "provenance.json"):
        assert sha256_file(first / filename) == sha256_file(second / filename)
