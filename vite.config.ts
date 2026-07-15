import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

function localCommitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_SHA__: JSON.stringify(
      process.env.CF_PAGES_COMMIT_SHA ??
        process.env.GITHUB_SHA ??
        localCommitSha(),
    ),
    __DEPLOYMENT_ENV__: JSON.stringify(
      process.env.CF_PAGES_BRANCH
        ? `cloudflare-pages:${process.env.CF_PAGES_BRANCH}`
        : mode,
    ),
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
}))
