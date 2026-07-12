# Cloudflare Pages deployment

Deployment is intentionally static and occurs only after CI is green.

- Repository: private GitHub repository.
- Build command: `npm ci && npm run build && npm run check:assets`.
- Output directory: `dist`.
- Node: 24.16.0.
- Runtime secrets: none.
- Pages Functions: none.

`public/_headers` supplies the CSP and other security headers. The application
must make no request outside its own origin. CI rejects files over 25 MiB and
builds containing more than 20,000 files.

The default `pages.dev` URL is acceptable for the first private professor
review. Custom-domain decisions occur after IP review.
