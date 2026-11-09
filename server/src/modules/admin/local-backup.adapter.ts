import { spawn, type ChildProcess } from 'node:child_process'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { constants, createReadStream, createWriteStream } from 'node:fs'
import { access, link, lstat, mkdir, open, readdir, readFile, realpath, rm, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export class BackupFailure extends Error { constructor(public code: string) { super(code) } }
export interface LocalBackupConfig { directory: string; key: Buffer; mongoConfigFile: string; database: string; timeoutMs: number; maxBytes: number; totalBytes: number }
export type ToolRunner = (args: string[], signal: AbortSignal) => ChildProcess
export const nativeTool: ToolRunner = (args, signal) => spawn('mongodump', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false, signal, killSignal: 'SIGKILL' })
const inside = (root: string, file: string) => { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) }
export async function privatePath(file: string, directory = false) {
  if (!path.isAbsolute(file)) throw new BackupFailure('BACKUP_INVALID_PATH')
  const info = await lstat(file)
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()) || (!directory && info.size > 16384)) throw new BackupFailure('BACKUP_INVALID_PATH')
  if (process.platform !== 'win32' && (info.mode & 0o077) !== 0) throw new BackupFailure('BACKUP_INSECURE_PERMISSIONS')
  return realpath(file)
}
/** Runtime secrets are intentionally separate from archives and the source checkout. */
export async function loadLocalBackupConfig(input: { directory: string; keyFile: string; mongoConfigFile: string; uri: string; timeoutMs: number; maxBytes: number; totalBytes: number }): Promise<LocalBackupConfig> {
  const root = await realpath(path.resolve(__dirname, '../../../..'))
  if (![input.directory, input.keyFile, input.mongoConfigFile].every(p => path.isAbsolute(p) && !inside(root, path.resolve(p)))) throw new BackupFailure('BACKUP_INVALID_PATH')
  await mkdir(input.directory, { recursive: true, mode: 0o700 })
  const directory = await privatePath(input.directory, true), keyPath = await privatePath(input.keyFile), mongoConfigFile = await privatePath(input.mongoConfigFile)
  if (inside(root, directory) || [keyPath, mongoConfigFile].some(p => inside(directory, p) || inside(root, p))) throw new BackupFailure('BACKUP_INVALID_PATH')
  const { key, database } = parseBackupSecrets(await readFile(keyPath, 'utf8'), await readFile(mongoConfigFile, 'utf8'), input.uri)
  if (input.maxBytes > input.totalBytes) throw new BackupFailure('BACKUP_INVALID_LIMIT')
  return { ...input, directory, key, mongoConfigFile, database }
}
export function parseBackupSecrets(keyText: string, configText: string, uri: string) {
  const rawKey = keyText.trim()
  if (!/^[A-Za-z0-9+/]{43}=$/.test(rawKey)) throw new BackupFailure('BACKUP_INVALID_KEY')
  const key = Buffer.from(rawKey, 'base64')
  if (key.length !== 32 || key.toString('base64') !== rawKey) throw new BackupFailure('BACKUP_INVALID_KEY')
  // JSON is a YAML subset accepted by Mongo tools, avoiding a new YAML parser dependency.
  let config: unknown
  try { config = JSON.parse(configText) } catch { throw new BackupFailure('BACKUP_INVALID_CONFIG') }
  if (!config || typeof config !== 'object' || Object.keys(config).join() !== 'uri' || (config as { uri?: unknown }).uri !== uri) throw new BackupFailure('BACKUP_CONFIG_URI_MISMATCH')
  let database: string
  // WHATWG URL rejects valid Mongo replica-set seed lists; URI validity is already checked by MongoDB.
  try { database = decodeURIComponent(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)(?:\?.*)?$/.exec(uri)?.[1] ?? '') } catch { throw new BackupFailure('BACKUP_INVALID_DATABASE') }
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(database) || ['admin', 'config', 'local'].includes(database)) throw new BackupFailure('BACKUP_INVALID_DATABASE')
  return { key, database }
}
function exitPromise(child: ChildProcess) {
  // Tool diagnostics may include a connection string. Consume them without logging or persisting.
  child.stderr?.resume()
  return new Promise<void>((resolve, reject) => {
    child.once('error', () => reject(new BackupFailure('BACKUP_TOOL_FAILED')))
    child.once('close', code => code === 0 ? resolve() : reject(new BackupFailure('BACKUP_TOOL_FAILED')))
  })
}
export async function verifyEncryptedBackup(file: string, key: Buffer, expectedHash?: string, signal?: AbortSignal) {
  const size = (await stat(file)).size
  if (size <= 32) throw new BackupFailure('BACKUP_INVALID_ARCHIVE')
  const handle = await open(file, 'r')
  const header = Buffer.alloc(16), tag = Buffer.alloc(16)
  try { await handle.read(header, 0, 16, 0); await handle.read(tag, 0, 16, size - 16) } finally { await handle.close() }
  if (header.subarray(0, 4).toString() !== 'NWB1') throw new BackupFailure('BACKUP_INVALID_ARCHIVE')
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(file)) { signal?.throwIfAborted(); hash.update(bytes) }
  const sha256 = hash.digest('hex')
  if (expectedHash && expectedHash !== sha256) throw new BackupFailure('BACKUP_CHECKSUM_MISMATCH')
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(4)); decipher.setAAD(header); decipher.setAuthTag(tag)
  try { await pipeline(createReadStream(file, { start: 16, end: size - 17 }), decipher, new Writable({ write(_chunk, _encoding, callback) { callback() } }), { signal }) }
  catch { throw new BackupFailure('BACKUP_AUTHENTICATION_FAILED') }
  return { sizeBytes: size, sha256 }
}
/** Stream a logical database archive; no plaintext disk artifact and no client-controlled paths. */
export function createLocalBackupAdapter(config: LocalBackupConfig, run: ToolRunner = nativeTool) {
  return {
    async check() {
      await privatePath(config.directory, true)
      await access(config.directory, constants.W_OK)
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000)
      try { const child = run(['--version'], controller.signal); child.stdout?.resume(); await exitPromise(child) }
      finally { clearTimeout(timer) }
    },
    async dump(jobId: string, owner: string, signal: AbortSignal) {
      if (!/^[a-f\d]{24}$/.test(jobId) || !/^[a-f\d-]{36}$/.test(owner) || config.key.length !== 32) throw new BackupFailure('BACKUP_INVALID_INPUT')
      await privatePath(config.directory, true)
      const names = await readdir(config.directory)
      if (names.length > 1000 || names.some(n => !/^[a-f\d]{24}-[a-f\d-]{36}\.nwbackup(?:\.partial)?$/.test(n))) throw new BackupFailure('BACKUP_STORAGE_NOT_DEDICATED')
      let occupied = 0
      for (const name of names) { const info = await lstat(path.join(config.directory, name)); if (!info.isFile() || info.isSymbolicLink()) throw new BackupFailure('BACKUP_INVALID_PATH'); occupied += info.size }
      const free = await statfs(config.directory)
      if (occupied + config.maxBytes > config.totalBytes || free.bavail * free.bsize < config.maxBytes) throw new BackupFailure('BACKUP_STORAGE_QUOTA')
      const artifactKey = `${jobId}-${owner}.nwbackup`, file = path.join(config.directory, artifactKey), partial = file + '.partial'
      const controller = new AbortController(), abort = () => controller.abort()
      signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort()
      let timedOut = false, bytes = 0, owned = false, published = false
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, config.timeoutMs)
      try {
        // Exclusive creation means cleanup can never delete another attempt's archive.
        const initial = await open(partial, 'wx', 0o600); owned = true; await initial.close()
        const header = Buffer.concat([Buffer.from('NWB1'), randomBytes(12)])
        const cipher = createCipheriv('aes-256-gcm', config.key, header.subarray(4)); cipher.setAAD(header)
        const output = new Transform({
          construct(callback) { this.push(header); bytes = header.length; callback() },
          transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; if (bytes + 16 > config.maxBytes) callback(new BackupFailure('BACKUP_SIZE_LIMIT')); else callback(null, chunk) },
          flush(callback) { this.push(cipher.getAuthTag()); callback() },
        })
        const child = run(['--config=' + config.mongoConfigFile, '--db=' + config.database, '--archive', '--gzip', '--quiet', '--numParallelCollections=2'], controller.signal)
        if (!child.stdout) throw new BackupFailure('BACKUP_TOOL_FAILED')
        // Wait for process exit as well as stream completion: a nonzero exit is never success.
        const completed = exitPromise(child)
        const streamed = pipeline(child.stdout, cipher, output, createWriteStream(partial, { flags: 'r+', start: 0 }), { signal: controller.signal })
        const outcomes = await Promise.allSettled([completed, streamed.catch(error => { controller.abort(); throw error })])
        const failed = outcomes.find(r => r.status === 'rejected' && r.reason instanceof BackupFailure && r.reason.code === 'BACKUP_SIZE_LIMIT') ?? outcomes.find(r => r.status === 'rejected')
        if (failed?.status === 'rejected') throw failed.reason
        if (controller.signal.aborted) throw new BackupFailure('BACKUP_ABORTED')
        const handle = await open(partial, 'r+'); try { await handle.sync() } finally { await handle.close() }
        const verified = await verifyEncryptedBackup(partial, config.key, undefined, controller.signal)
        if (controller.signal.aborted) throw new BackupFailure('BACKUP_ABORTED')
        // Atomic exclusive publish. rename can overwrite an existing final file on some platforms.
        await link(partial, file); published = true
        await rm(partial)
        if (process.platform !== 'win32') { const parent = await open(config.directory, 'r'); try { await parent.sync() } finally { await parent.close() } }
        return { artifactKey, ...verified }
      } catch (error) {
        controller.abort()
        if (owned) await rm(partial, { force: true })
        if (published) await rm(file, { force: true })
        if (timedOut) throw new BackupFailure('BACKUP_TIMEOUT')
        if (signal.aborted) throw new BackupFailure('BACKUP_ABORTED')
        if (error instanceof BackupFailure) throw error
        throw new BackupFailure('BACKUP_STORAGE_OR_TOOL_FAILED')
      } finally { clearTimeout(timer); signal.removeEventListener('abort', abort) }
    },
  }
}
