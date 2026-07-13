import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const assetsDirectory = join(root, 'assets')
const kib = (bytes) => bytes / 1024

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesRecursively(path) : [path]
  }))).flat()
}

const indexHtml = await readFile(join(root, 'index.html'), 'utf8')
const mainMatch = indexHtml.match(/<script[^>]+src="\/assets\/(index-[^"]+\.js)"/)
if (!mainMatch) throw new Error('No se encontro el chunk inicial en dist/index.html.')

const assetFiles = await filesRecursively(assetsDirectory)
const javascriptFiles = assetFiles.filter((file) => file.endsWith('.js'))
const cssFiles = assetFiles.filter((file) => file.endsWith('.css'))
const mainFile = javascriptFiles.find((file) => file.endsWith(mainMatch[1]))
if (!mainFile) throw new Error(`No se encontro ${mainMatch[1]} en dist/assets.`)

async function gzipSize(file) {
  return gzipSync(await readFile(file)).byteLength
}

const mainGzip = kib(await gzipSize(mainFile))
const totalJavascriptGzip = kib((await Promise.all(javascriptFiles.map(gzipSize))).reduce((sum, size) => sum + size, 0))
const totalCssGzip = kib((await Promise.all(cssFiles.map(gzipSize))).reduce((sum, size) => sum + size, 0))
const distFiles = await filesRecursively(root)
const offlineFiles = distFiles.filter((file) => {
  const name = relative(root, file).replaceAll('\\', '/')
  return name !== 'sw.js' && !name.startsWith('workbox-') && !name.startsWith('.vite/')
})
const offlineRaw = kib((await Promise.all(offlineFiles.map((file) => stat(file)))).reduce((sum, entry) => sum + entry.size, 0))

const budgets = {
  mainGzip: 110,
  totalJavascriptGzip: 190,
  totalCssGzip: 9,
  offlineRaw: 715
}

const measurements = { mainGzip, totalJavascriptGzip, totalCssGzip, offlineRaw }
const failures = Object.entries(budgets)
  .filter(([metric, limit]) => measurements[metric] > limit)
  .map(([metric, limit]) => `${metric}: ${measurements[metric].toFixed(2)} KiB > ${limit} KiB`)

console.log(`Performance budget: main ${mainGzip.toFixed(2)} KiB gzip, JS total ${totalJavascriptGzip.toFixed(2)} KiB gzip, CSS ${totalCssGzip.toFixed(2)} KiB gzip, offline ${offlineRaw.toFixed(2)} KiB.`)
if (failures.length) throw new Error(`Presupuesto de rendimiento excedido:\n${failures.join('\n')}`)
