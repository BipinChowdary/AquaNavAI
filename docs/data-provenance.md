# Data provenance policy

Every source snapshot must record provider, product, exact URL, product/cycle
identifier, UTC retrieval time, SHA-256, variables, units, bounding box, time
range, CRS, vertical datum, missing-value handling, transformations, and formal
citation.

CUDEM is the planned feasibility-mask source. ETOPO supplies regional context,
not navigation detail. RTOFS supplies surface-current forcing, not obstacle
geometry. NDBC supplies point observations and later wave/wind validation, not
spatial current truth.

Raw and processed data are ignored. Only reviewed, bounded web derivatives are
committed. Interpolation onto the 500 m grid must never be described as
increasing the native environmental-data resolution.

`south-florida-v1` currently has `status: proxy`; its provenance explicitly
states that source acquisition is pending.
