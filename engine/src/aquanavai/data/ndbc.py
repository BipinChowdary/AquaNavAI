from __future__ import annotations

from io import StringIO

import pandas as pd


def parse_realtime_text(text: str) -> pd.DataFrame:
    """Parse an NDBC realtime flat file and normalize time/missing values."""
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 3 or not lines[0].startswith("#"):
        raise ValueError("NDBC input does not contain the expected header and observations")
    data_lines = [lines[0], *(lines[2:] if lines[1].startswith("#") else lines[1:])]
    frame = pd.read_csv(
        StringIO("\n".join(data_lines)),
        sep=r"\s+",
        na_values=["MM", "999", "999.0", "99.0"],
        comment=None,
    )
    frame.columns = [str(column).lstrip("#") for column in frame.columns]
    year = "YYYY" if "YYYY" in frame else "YY"
    required = [year, "MM", "DD", "hh", "mm"]
    if not all(column in frame for column in required):
        raise ValueError(f"NDBC input is missing timestamp columns: {required}")
    years = frame[year].astype(int)
    if year == "YY":
        years = years.map(lambda value: 2000 + value if value < 70 else 1900 + value)
    frame["timestamp_utc"] = pd.to_datetime(
        {
            "year": years,
            "month": frame["MM"],
            "day": frame["DD"],
            "hour": frame["hh"],
            "minute": frame["mm"],
        },
        utc=True,
        errors="coerce",
    )
    return frame.dropna(subset=["timestamp_utc"]).reset_index(drop=True)
