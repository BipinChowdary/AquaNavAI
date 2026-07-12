from __future__ import annotations

import hashlib
from pathlib import Path

import httpx


class FetchError(RuntimeError):
    """Raised when a remote source cannot be pinned safely."""


def fetch_file(url: str, destination: Path, expected_sha256: str | None = None) -> str:
    """Download one explicitly requested source and return its SHA-256 digest."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    digest = hashlib.sha256()
    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as response:
            response.raise_for_status()
            with temporary.open("wb") as handle:
                for chunk in response.iter_bytes():
                    handle.write(chunk)
                    digest.update(chunk)
    except (httpx.HTTPError, OSError) as error:
        temporary.unlink(missing_ok=True)
        raise FetchError(f"Unable to fetch {url}: {error}") from error

    actual = digest.hexdigest()
    if expected_sha256 and actual.lower() != expected_sha256.lower():
        temporary.unlink(missing_ok=True)
        raise FetchError(f"Checksum mismatch for {url}: expected {expected_sha256}, got {actual}")
    temporary.replace(destination)
    return actual
