import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { lstat, open, readFile } from 'node:fs/promises'
import { createDecipheriv } from 'node:crypto'
import mongoose from 'mongoose'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { BackupFailure, privatePath, verifyEncryptedBackup } from './local-backup.adapter.js'

type RestoreInput = { archive: string; key: Buffer; sha256: string; sourceDatabase: string; uri: string; mongoConfigFile: string }
type RestoreRunner = (args: string[]) => ChildProcess
const nativeRestore: RestoreRunner = args => spawn('mongorestore', args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true, shell: false, timeout: 600000, killSignal: 'SIGKILL' })
/** CLI-only recovery rehearsal. Never restore into an existing database or a remote endpoint. */
export async function restoreToIsolatedDatabase(input: RestoreInput, run: RestoreRunner = nativeRestore) {
  let url: URL
  try { url = new URL(input.uri) } catch { throw new BackupFailure('RESTORE_TARGET_REJECTED') }
  const targetDatabase = url.pathname.slice(1)
  if (url.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/^novel_backup_restore_test_[a-f\d]{32}$/.test(targetDatabase) || !/^[A-Za-z0-9_-]{1,63}$/.test(input.sourceDatabase) || ['admin', 'config', 'local', targetDatabase].includes(input.sourceDatabase) || !/^[a-f\d]{64}$/.test(input.sha256)) throw new BackupFailure('RESTORE_TARGET_REJECTED')
  await privatePath(input.mongoConfigFile)
  if (await readRestoreConfig(input.mongoConfigFile) !== input.uri) throw new BackupFailure('BACKUP_CONFIG_URI_MISMATCH')
  if (!(await lstat(input.archive)).isFile()) throw new BackupFailure('BACKUP_INVALID_ARCHIVE')
  await verifyEncryptedBackup(input.archive, input.key, input.sha256)
  // A second authenticated pass streams to the isolated target; any failure removes only that new DB.
  const connection = mongoose.createConnection(input.uri, { serverSelectionTimeoutMS: 5000, autoIndex: false })
  let ownsTarget = false
  try {
    await connection.asPromise()
    if (await connection.db!.listCollections().hasNext()) throw new BackupFailure('RESTORE_TARGET_NOT_EMPTY')
    await connection.db!.collection<{ _id: string; owner: string }>('__backup_restore_lock').insertOne({ _id: 'restore', owner: randomUUID() })
    // Collection creation occurs before any archive writes; another invocation sees a nonempty DB.
    ownsTarget = true
    const handle = await open(input.archive, 'r'), header = Buffer.alloc(16), tag = Buffer.alloc(16)
    let size: number
    try { size = (await handle.stat()).size; await handle.read(header, 0, 16, 0); await handle.read(tag, 0, 16, size - 16) } finally { await handle.close() }
    const decipher = createDecipheriv('aes-256-gcm', input.key, header.subarray(4)); decipher.setAAD(header); decipher.setAuthTag(tag)
    const child = run(['--config=' + input.mongoConfigFile, '--archive', '--gzip', '--quiet', '--stopOnError', '--nsInclude=' + input.sourceDatabase + '.*', '--nsFrom=' + input.sourceDatabase + '.*', '--nsTo=' + targetDatabase + '.*'])
    child.stderr?.resume()
    const completed = new Promise<void>((resolve, reject) => { child.once('error', () => reject(new BackupFailure('RESTORE_TOOL_FAILED'))); child.once('close', code => code === 0 ? resolve() : reject(new BackupFailure('RESTORE_TOOL_FAILED'))) })
    if (!child.stdin) { child.kill('SIGKILL'); throw new BackupFailure('RESTORE_TOOL_FAILED') }
    const streamed = pipeline(createReadStream(input.archive, { start: 16, end: size - 17 }), decipher, child.stdin).catch(error => { child.kill('SIGKILL'); throw error })
    const results = await Promise.allSettled([completed, streamed])
    if (results.some(r => r.status === 'rejected')) throw new BackupFailure('RESTORE_TOOL_OR_AUTHENTICATION_FAILED')
    return { database: targetDatabase, collections: await connection.db!.listCollections().toArray() }
  } catch (error) {
    // Guard is established before any write. An occupied target is never dropped.
    if (ownsTarget && connection.name === targetDatabase) await connection.dropDatabase()
    if (error instanceof BackupFailure) throw error
    throw new BackupFailure('RESTORE_FAILED')
  } finally { await connection.close() }
}

export async function readRestoreConfig(file: string) {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'))
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'uri' || typeof (value as { uri?: unknown }).uri !== 'string') throw new BackupFailure('BACKUP_INVALID_CONFIG')
  return (value as { uri: string }).uri
}
