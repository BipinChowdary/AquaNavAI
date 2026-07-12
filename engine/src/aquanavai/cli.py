from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer

from aquanavai.config import load_scenario, load_vehicle, repository_root
from aquanavai.energy.compute import computation_emissions
from aquanavai.evaluation.runner import evaluate_scenario
from aquanavai.export.web import export_web_scenario
from aquanavai.provenance import sha256_file, write_json

app = typer.Typer(help="AquaNavAI reproducible coastal routing research engine.")
data_app = typer.Typer(help="Explicit network acquisition and local validation commands.")
app.add_typer(data_app, name="data")


def _scenario_option() -> str:
    return "south-florida-v1"


@data_app.command("fetch")
def fetch_data(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
) -> None:
    config = load_scenario(scenario)
    if config.offline_proxy:
        raise typer.BadParameter(
            "The scenario catalog is in proxy mode. Pin exact NOAA URLs and expected checksums "
            "in data/catalog.yaml before any network acquisition."
        )


@data_app.command("validate")
def validate_data(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
) -> None:
    root = repository_root() / "public" / "scenarios" / scenario
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        raise typer.BadParameter(f"Missing scenario manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures = []
    for filename, expected in manifest["checksums"].items():
        path = root / filename
        if not path.exists():
            failures.append(f"missing {filename}")
        elif sha256_file(path) != expected:
            failures.append(f"checksum mismatch {filename}")
    if failures:
        raise typer.BadParameter("; ".join(failures))
    typer.echo(f"Validated {len(manifest['checksums'])} pinned artifacts for {scenario}.")


@app.command("route")
def route(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
    algorithm: Annotated[str, typer.Option(help="distance or environmental")] = "environmental",
) -> None:
    if algorithm not in {"distance", "environmental"}:
        raise typer.BadParameter("algorithm must be distance or environmental")
    bundle = evaluate_scenario(load_scenario(scenario), load_vehicle(), all_cycles=False)
    selected = [result for result in bundle.results if result.algorithm == algorithm]
    typer.echo(
        json.dumps(
            [item.model_dump(mode="json", exclude={"coordinates"}) for item in selected], indent=2
        )
    )


@app.command("evaluate")
def evaluate(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
    output: Annotated[Path, typer.Option(help="Generated experiment artifact.")] = Path(
        "artifacts/experiments/south-florida-v1/results.json"
    ),
    track_compute: Annotated[
        bool, typer.Option(help="Enable controlled CodeCarbon tracking.")
    ] = False,
) -> None:
    with computation_emissions(output.parent, enabled=track_compute):
        bundle = evaluate_scenario(load_scenario(scenario), load_vehicle(), all_cycles=True)
    write_json(
        output,
        {
            "scenarioId": scenario,
            "pairedCases": len(bundle.results) // 2,
            "results": [
                item.model_dump(mode="json", exclude={"coordinates"}) for item in bundle.results
            ],
        },
    )
    typer.echo(f"Wrote {len(bundle.results) // 2} paired cases to {output}")


@app.command("export-web")
def export_web(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
) -> None:
    output = export_web_scenario(load_scenario(scenario), load_vehicle())
    typer.echo(f"Exported immutable static scenario to {output}")


@app.command("reproduce")
def reproduce(
    scenario: Annotated[str, typer.Option(help="Scenario identifier.")] = _scenario_option(),
    offline: Annotated[bool, typer.Option(help="Forbid remote acquisition.")] = False,
) -> None:
    config = load_scenario(scenario)
    if not offline:
        raise typer.BadParameter(
            "Reproduction requires --offline; use 'data fetch' explicitly for network access."
        )
    if not config.offline_proxy:
        raw = repository_root() / "data" / "raw" / scenario
        if not raw.exists():
            raise typer.BadParameter(
                f"Offline cache is missing at {raw}; run "
                f"'aquanav data fetch --scenario {scenario}' explicitly."
            )
    output = export_web_scenario(config, load_vehicle())
    validate_data(scenario)
    typer.echo(f"Offline reproduction complete: {output}")


if __name__ == "__main__":
    app()
