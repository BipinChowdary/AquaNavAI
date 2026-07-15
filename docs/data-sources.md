# Data sources and scientific boundary

## CUDEM

Five official NOAA NCEI Florida 1/9-arc-second topobathymetry tiles cover the bounded study domain. Elevation is reprojected from NAD83 to EPSG:32617 at 500 m. CUDEM is the sole authoritative v1 feasibility source; ETOPO is not combined into the mask. This is not a chart datum or a nautical chart.

## RTOFS

`rtofs_glo.t00z.f024_west_atl_std.grb2` from the 2026-07-12 00Z cycle supplies paired surface `UOGRD` and `VOGRD` fields in m/s for valid times 01Z through 24Z. Metadata checks verify the 0 m below-sea-level level, NoData 9999, north-up grid, and component names. Components are bilinearly reprojected without sign swaps. Where the coarse RTOFS land mask conflicts with CUDEM-confirmed water, the nearest RTOFS wet cell fills the coastal model-mask gap; this limitation is public.

## NDBC

Station 41122 (Hollywood Beach) supplies contextual wave observations and LKWF1 (Lake Worth) supplies meteorological context. `MM` becomes null. These point observations do not replace or spatially validate RTOFS currents.

## Waves

No aligned WAVEWATCH III subset is pinned for v1. NDBC wave height is not spread over the grid and no wave term appears in route cost. The next scientific extension must pin a cycle-aligned official field and evaluate its uncertainty before enabling a weight.

Exact URLs, timestamps, variables, checksums, and usage notes are in `data/catalog.yaml`.
