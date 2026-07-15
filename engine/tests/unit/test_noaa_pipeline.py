import numpy as np
import pytest

from aquanavai.pipeline.build_noaa_scenario import (
    _acquire_and_validate_raw,
    _encode_array,
    _fill_nearest_rtofs_wet_cell,
)


def test_nearest_rtofs_wet_cell_fill_preserves_components_and_time() -> None:
    values = np.array([[[1.0, np.nan], [np.nan, 4.0]], [[2.0, np.nan], [np.nan, 8.0]]])
    filled = _fill_nearest_rtofs_wet_cell(values)
    assert np.isfinite(filled).all()
    assert filled[0, 0, 0] == 1.0
    assert filled[1, 0, 0] == 2.0
    assert set(np.unique(filled[0])).issubset({1.0, 4.0})


def test_binary_grid_encoding_is_little_endian_and_scaled() -> None:
    import base64

    encoded = _encode_array(np.array([0.0, 1.23, -0.25]), "i2", 0.01)
    decoded = np.frombuffer(base64.b64decode(encoded), dtype="<i2")
    assert decoded.tolist() == [0, 123, -25]


def test_offline_acquisition_fails_with_actionable_missing_file(tmp_path) -> None:
    catalog = {
        "scenarios": {
            "south-florida-noaa-v1": {
                "sources": [
                    {
                        "id": "cudem",
                        "files": [{"url": "https://example.invalid/tile.tif", "sha256": "0" * 64}],
                    }
                ]
            }
        }
    }
    with pytest.raises(FileNotFoundError, match="aquanav data fetch"):
        _acquire_and_validate_raw(catalog, tmp_path, allow_network=False)
