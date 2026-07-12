"""NOAA data-source adapters and validation helpers."""

from .fetch import FetchError, fetch_file

__all__ = ["FetchError", "fetch_file"]
