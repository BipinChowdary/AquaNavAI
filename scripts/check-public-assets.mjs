import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
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

await walk(root)
if (files.length > maxFiles) throw new Error(`Build has ${files.length} files; limit is ${maxFiles}.`)
for (const file of files) {
  const info = await stat(file)
  if (info.size > maxBytes) {
    throw new Error(`${relative(root, file)} is ${info.size} bytes; limit is ${maxBytes}.`)
  }
}
console.log(`Asset check passed: ${files.length} files, all below 25 MiB.`)
