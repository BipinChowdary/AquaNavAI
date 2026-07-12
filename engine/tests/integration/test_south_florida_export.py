import json

from aquanavai.config import load_scenario, load_vehicle
from aquanavai.export.web import export_web_scenario


def test_south_florida_export_contains_thirty_paired_cases(tmp_path) -> None:
    output = export_web_scenario(load_scenario("south-florida-v1"), load_vehicle(), tmp_path)
    metrics = json.loads((output / "metrics.json").read_text(encoding="utf-8"))
    routes = json.loads((output / "routes.geojson").read_text(encoding="utf-8"))
    assert len(metrics["results"]) == 60
    assert len(routes["features"]) == 60
    assert metrics["dataMode"] == "offline-proxy"
