import { spawn } from 'node:child_process'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = path.join(root, 'android')
const isWindows = process.platform === 'win32'
const command = isWindows ? 'cmd.exe' : './gradlew'
const args = isWindows
  ? ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon']
  : ['assembleDebug', '--no-daemon']

await new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: androidDir,
    env: process.env,
    stdio: 'inherit'
  })

  child.once('error', reject)
  child.once('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`Gradle termino con codigo ${code ?? 'desconocido'}.`))
  })
})

const source = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const outputDir = path.join(root, 'artifacts')
const destination = path.join(outputDir, 'SBS-Strength-v0.1.0-debug.apk')

await mkdir(outputDir, { recursive: true })
await copyFile(source, destination)
console.log(`APK generated at ${destination}`)
