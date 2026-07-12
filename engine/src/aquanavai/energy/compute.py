from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def computation_emissions(output_dir: Path, enabled: bool = False) -> Iterator[None]:
    """Optionally track compute emissions, kept separate from propulsion energy."""
    if not enabled:
        yield
        return

    from codecarbon import OfflineEmissionsTracker

    output_dir.mkdir(parents=True, exist_ok=True)
    tracker = OfflineEmissionsTracker(
        project_name="aquanavai-engine",
        output_dir=str(output_dir),
        output_file="compute-emissions.csv",
        save_to_file=True,
        country_iso_code="USA",
        log_level="error",
    )
    tracker.start()
    try:
        yield
    finally:
        tracker.stop()
