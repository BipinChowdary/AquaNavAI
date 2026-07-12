import pandas as pd

from aquanavai.data.ndbc import parse_realtime_text


def test_ndbc_missing_values_and_utc_time_are_normalized() -> None:
    text = "\n".join(
        (
            "#YY MM DD hh mm WDIR WSPD",
            "#yr mo dy hr mn degT m/s",
            "26 07 12 12 30 090 5.2",
            "26 07 12 13 30 MM MM",
        )
    )
    frame = parse_realtime_text(text)
    assert len(frame) == 2
    assert str(frame.loc[0, "timestamp_utc"]) == "2026-07-12 12:30:00+00:00"
    assert pd.isna(frame.loc[1, "WDIR"])
