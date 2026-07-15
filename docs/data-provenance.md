# Data provenance policy

Every snapshot records provider, product, exact URL, product/cycle identifier, UTC retrieval time, SHA-256, variables, units, bounding box, time range, CRS, vertical datum, missing-value handling, transformations, and citation.

Navigation V2 uses NOAA CUDEM as its bathymetry and feasibility source, NOAA RTOFS as modelled surface-current forcing, and NDBC as contextual observations. NDBC is not spatial current ground truth. Interpolation to 500 m never increases native environmental resolution.

NOAA ENC and ENC Direct to GIS were audited as future chart-context sources. No ENC edition or feature class is integrated because a bounded, checksummed extraction has not yet been pinned. V2 therefore does not claim charted wreck, obstruction, channel, restriction, or marine-boundary avoidance. ENC Direct to GIS is useful for research/GIS demonstration but is not certified for operational navigation.

Raw downloads are ignored. Reviewed bounded derivatives are committed with checksums. `south-florida-noaa-v1` is the NOAA-derived release; `south-florida-v1` remains a separate deterministic proxy fixture and is never represented as NOAA-derived.
