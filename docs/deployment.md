# Cloudflare Pages deployment

## Dashboard configuration

- Git repository: `BipinChowdary/AquaNavAI` (private)
- Production branch: `main`
- Root directory: blank / repository root
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `24.16.0` (set `NODE_VERSION=24.16.0` if the dashboard requires it)
- Pages Functions: none
- Runtime secrets: none

`VITE_MAP_STYLE_URL` is optional and **public** because Vite embeds it in client JavaScript. Do not put a private token in this value. When absent, the bundled NOAA bathymetry/coastline style is used with no external map requests.
If an external style is approved, add only that provider's exact HTTPS hosts to the CSP `connect-src` and `img-src`, document its attribution/usage terms, and retain the local fallback.

The prior blank deployment occurred because Pages reported “No build command specified. Skipping build step.” Do not add Wrangler to compensate; correct the dashboard build command and retry it from the deployment detail page. Build logs must show `npm run build` and a generated `dist/index.html`.

Preview deployments build non-production branches. Promote only a reviewed `main` commit. Roll back by selecting the last verified production deployment and choosing rollback. Inspect build logs from the deployment detail page.

## Pre- and post-deployment checks

1. Run `npm ci && npm run check && npm run test:e2e` locally.
2. Confirm `dist/index.html`, hashed `/assets/`, `_headers`, schemas, both scenarios, and `navigation-grid.json` exist.
3. Confirm every file is below 25 MiB and total file count below the Free-plan 20,000-file limit. Paid Pages plans currently allow 100,000 files when configured as documented; CI intentionally enforces the stricter Free-plan boundary. See https://developers.cloudflare.com/pages/platform/limits/.
4. Search `dist` for secrets, `localhost`, `C:\Users\`, and live NOAA URLs used as runtime fetches.
5. Open the production root and directly refresh it; verify first-party JS/CSS/data are HTTP 200.
6. Block external networking and verify the map, missions, routes, provenance, and ASV animation.
7. Inspect response headers for CSP, `nosniff`, `DENY`, no-referrer, and restrictive permissions.

No deployment is considered complete until the public URL is retrieved and these checks pass.
