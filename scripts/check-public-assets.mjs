import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const maxBytes = 25 * 1024 * 1024
const maxFiles = 20_000
const files = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else files.push(path)
  }
}

function insideBuild(path) {
  const resolved = resolve(path)
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`))
    throw new Error(`Build reference escapes dist: ${path}`)
  return resolved
}

async function assertExists(path, label) {
  try {
    await stat(insideBuild(path))
  } catch {
    throw new Error(`${label} is missing from the production build.`)
  }
}

await walk(root)
if (files.length > maxFiles)
  throw new Error(`Build has ${files.length} files; limit is ${maxFiles}.`)
for (const file of files) {
  const info = await stat(file)
  if (info.size > maxBytes) {
    throw new Error(
      `${relative(root, file)} is ${info.size} bytes; limit is ${maxBytes}.`,
    )
  }
}

const indexHtml = await readFile(join(root, 'index.html'), 'utf8')
for (const match of indexHtml.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const reference = match[1]
  if (/^(?:https?:|data:)/.test(reference)) continue
  await assertExists(join(root, reference.replace(/^\//, '')), reference)
}

const releaseIndexPath = join(root, 'scenarios', 'index.json')
const releaseIndex = JSON.parse(await readFile(releaseIndexPath, 'utf8'))
for (const scenario of releaseIndex.scenarios) {
  const manifestPath = join(root, scenario.manifest.replace(/^\//, ''))
  await assertExists(manifestPath, `${scenario.id} manifest`)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.id !== scenario.id || manifest.version !== scenario.version)
    throw new Error(`${scenario.id} release index identity does not match.`)
  for (const [name, expected] of Object.entries(manifest.checksums)) {
    const artifactPath = join(dirname(manifestPath), name)
    await assertExists(artifactPath, `${scenario.id}/${name}`)
    const actual = createHash('sha256')
      .update(await readFile(artifactPath))
      .digest('hex')
    if (actual !== expected)
      throw new Error(
        `${scenario.id}/${name} checksum does not match manifest.`,
      )
  }
}

const workerChunks = files.filter((file) =>
  /assets[\\/]routeWorker-[^\\/]+\.js$/.test(file),
)
if (workerChunks.length !== 1)
  throw new Error(
    `Expected one bundled routing worker chunk; found ${workerChunks.length}.`,
  )

const scripts = await Promise.all(
  files
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFile(file, 'utf8')),
)
if (scripts.some((source) => /serviceWorker\s*\.\s*register/.test(source)))
  throw new Error(
    'Unexpected service-worker registration found in build output.',
  )

const headers = await readFile(join(root, '_headers'), 'utf8')
if (!headers.includes('/assets/*') || !headers.includes('immutable'))
  throw new Error('Immutable cache policy for hashed assets is missing.')
if (!headers.includes('/scenarios/index.json'))
  throw new Error('Release-index revalidation policy is missing.')
if (
  !headers.includes('/scenarios/*/navigation-grid.json') ||
  !headers.includes('/scenarios/*/routes.geojson')
)
  throw new Error(
    'Immutable cache policy for checksum-addressed data is missing.',
  )

console.log(
  `Asset graph passed: ${files.length} files, ${releaseIndex.scenarios.length} scenarios, one worker chunk, all artifacts checksummed below 25 MiB.`,
)
