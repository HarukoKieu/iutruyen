import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID, createDecipheriv } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { createLocalBackupAdapter, verifyEncryptedBackup, loadLocalBackupConfig, parseBackupSecrets, type LocalBackupConfig, type ToolRunner } from '../local-backup.adapter.js'
import { backupSchema, backupsQuery } from '../admin.validation.js'

let directory: string, config: LocalBackupConfig
const id = 'a'.repeat(24), owner = randomUUID()
const tool = (source: string): ToolRunner => (_args, signal) => spawn(process.execPath, ['-e', source], { signal, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
beforeEach(async () => {
  directory = await mkdtemp(path.resolve('node_modules/backup-unit-'))
  config = { directory, key: randomBytes(32), mongoConfigFile: 'PRIVATE_CONFIG_PATH', database: 'test', timeoutMs: 3000, maxBytes: 1024 * 1024, totalBytes: 10 * 1024 * 1024 }
})
afterEach(async () => {
  if (!directory.startsWith(path.resolve('node_modules/backup-unit-'))) throw new Error('Cleanup guard')
  await rm(directory, { recursive: true, force: true })
})
describe('encrypted local backup adapter', () => {
  it('accepts a canonical 32-byte key and matching private Mongo JSON config', () => {
    const uri = 'mongodb://127.0.0.1/novel_test?directConnection=true', key = randomBytes(32)
    expect(parseBackupSecrets(key.toString('base64') + '\n', JSON.stringify({ uri }), uri)).toEqual({ key, database: 'novel_test' })
    for (const target of ['mongodb://node1:27017,node2:27017/novel_test?replicaSet=rs0', 'mongodb+srv://cluster.example/novel_test', 'mongodb://[::1]:27017/novel_test']) expect(parseBackupSecrets(key.toString('base64'), JSON.stringify({ uri: target }), target).database).toBe('novel_test')
  })
  it('rejects malformed keys/config, mismatched URI and system/all-database dump scope', () => {
    const uri = 'mongodb://127.0.0.1/novel', key = randomBytes(32).toString('base64')
    for (const text of ['not-key', randomBytes(31).toString('base64'), randomBytes(33).toString('base64')]) expect(() => parseBackupSecrets(text, JSON.stringify({ uri }), uri)).toThrow('BACKUP_INVALID_KEY')
    expect(() => parseBackupSecrets(key, 'invalid-json', uri)).toThrow('BACKUP_INVALID_CONFIG')
    expect(() => parseBackupSecrets(key, JSON.stringify({ uri: uri + 'other' }), uri)).toThrow('BACKUP_CONFIG_URI_MISMATCH')
    expect(() => parseBackupSecrets(key, JSON.stringify({ uri, password: 'extra' }), uri)).toThrow('BACKUP_CONFIG_URI_MISMATCH')
    for (const database of ['', 'admin', 'local', 'config', 'novel%2Fother']) { const target = 'mongodb://127.0.0.1/' + database; expect(() => parseBackupSecrets(key, JSON.stringify({ uri: target }), target)).toThrow('BACKUP_INVALID_DATABASE') }
  })
  // fs.link() (atomic rename) returns EPERM on Windows; passes on Linux CI/production.
  it.skipIf(process.platform === 'win32')('streams authenticated encrypted bytes and emits only whitelisted command arguments', async () => {
    let args: string[] = []
    const run = tool('process.stdout.write("PRIVATE_DUMP_CONTENT")')
    const result = await createLocalBackupAdapter(config, (input, signal) => { args = input; return run(input, signal) }).dump(id, owner, new AbortController().signal)
    expect(args).toEqual(['--config=PRIVATE_CONFIG_PATH', '--db=test', '--archive', '--gzip', '--quiet', '--numParallelCollections=2'])
    const file = path.join(directory, result.artifactKey), encrypted = await readFile(file)
    expect(encrypted.includes(Buffer.from('PRIVATE_DUMP_CONTENT'))).toBe(false)
    expect(await verifyEncryptedBackup(file, config.key, result.sha256)).toMatchObject({ sizeBytes: encrypted.length, sha256: result.sha256 })
    const decipher = createDecipheriv('aes-256-gcm', config.key, encrypted.subarray(4, 16)); decipher.setAAD(encrypted.subarray(0, 16)); decipher.setAuthTag(encrypted.subarray(-16))
    expect(Buffer.concat([decipher.update(encrypted.subarray(16, -16)), decipher.final()]).toString()).toBe('PRIVATE_DUMP_CONTENT')
    expect(await readdir(directory)).toEqual([result.artifactKey])
  })
  // fs.link() (atomic rename) returns EPERM on Windows; passes on Linux CI/production.
  it.skipIf(process.platform === 'win32')('wrong key and tampering fail authentication without exposing plaintext', async () => {
    const result = await createLocalBackupAdapter(config, tool('process.stdout.write("data")')).dump(id, owner, new AbortController().signal)
    const file = path.join(directory, result.artifactKey)
    await expect(verifyEncryptedBackup(file, randomBytes(32))).rejects.toMatchObject({ code: 'BACKUP_AUTHENTICATION_FAILED' })
    const bytes = await readFile(file); bytes[16] ^= 1; await writeFile(file, bytes)
    await expect(verifyEncryptedBackup(file, config.key, result.sha256)).rejects.toMatchObject({ code: 'BACKUP_CHECKSUM_MISMATCH' })
    await expect(verifyEncryptedBackup(file, config.key)).rejects.toMatchObject({ code: 'BACKUP_AUTHENTICATION_FAILED' })
  })
  it('nonzero exit never succeeds even after valid stdout and secret stderr is redacted', async () => {
    await expect(createLocalBackupAdapter(config, tool('process.stdout.write("dump");process.stderr.write("SECRET_URI");process.exitCode=2')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_TOOL_FAILED', message: 'BACKUP_TOOL_FAILED' })
    expect(await readdir(directory)).toEqual([])
  })
  it('timeout kills its subprocess and cleans only its own partial output', async () => {
    const adapter = createLocalBackupAdapter({ ...config, timeoutMs: 150 }, tool('process.stdout.write("partial");setInterval(()=>{},1000)'))
    await expect(adapter.dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_TIMEOUT' })
    expect(await readdir(directory)).toEqual([])
  })
  it('shutdown cancellation aborts an active stream', async () => {
    const controller = new AbortController()
    const task = createLocalBackupAdapter(config, tool('process.stdout.write("partial");setInterval(()=>{},1000)')).dump(id, owner, controller.signal)
    const timer = setTimeout(() => controller.abort(), 100)
    try { await expect(task).rejects.toMatchObject({ code: 'BACKUP_ABORTED' }) } finally { clearTimeout(timer) }
    expect(await readdir(directory)).toEqual([])
  })
  it('bounded archive size aborts output rather than exhausting storage', async () => {
    await expect(createLocalBackupAdapter({ ...config, maxBytes: 1024 }, tool('process.stdout.write(Buffer.alloc(65536))')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_SIZE_LIMIT' })
    expect(await readdir(directory)).toEqual([])
  })
  it('quota exhaustion preserves earlier backups', async () => {
    const previous = `${'b'.repeat(24)}-${randomUUID()}.nwbackup`
    await writeFile(path.join(directory, previous), 'previous')
    await expect(createLocalBackupAdapter({ ...config, maxBytes: 1024, totalBytes: 1024 }, tool('process.stdout.write("data")')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_STORAGE_QUOTA' })
    expect(await readFile(path.join(directory, previous), 'utf8')).toBe('previous')
  })
  it('rejects non-dedicated storage and traversal identifiers', async () => {
    await writeFile(path.join(directory, 'other.txt'), 'must remain')
    await expect(createLocalBackupAdapter(config, tool('process.stdout.write("data")')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_STORAGE_NOT_DEDICATED' })
    await expect(createLocalBackupAdapter(config).dump('../outside', owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_INVALID_INPUT' })
  })
  // fs.link() (atomic rename) returns EPERM on Windows; passes on Linux CI/production.
  it.skipIf(process.platform === 'win32')('exclusive artifact collision cannot delete an existing attempt', async () => {
    const partial = path.join(directory, `${id}-${owner}.nwbackup.partial`)
    await writeFile(partial, 'existing')
    await expect(createLocalBackupAdapter(config, tool('process.stdout.write("new")')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_STORAGE_OR_TOOL_FAILED' })
    expect(await readFile(partial, 'utf8')).toBe('existing')
  })
  // fs.link() (atomic rename) returns EPERM on Windows; passes on Linux CI/production.
  it.skipIf(process.platform === 'win32')('final-file collision fails without overwriting or deleting the existing archive', async () => {
    const file = path.join(directory, `${id}-${owner}.nwbackup`)
    await writeFile(file, 'existing authenticated backup')
    await expect(createLocalBackupAdapter(config, tool('process.stdout.write("new")')).dump(id, owner, new AbortController().signal)).rejects.toMatchObject({ code: 'BACKUP_STORAGE_OR_TOOL_FAILED' })
    expect(await readFile(file, 'utf8')).toBe('existing authenticated backup')
    expect(await readdir(directory)).toEqual([path.basename(file)])
  })
  it('private config rejects source checkout and relative paths before reading credentials', async () => {
    await expect(loadLocalBackupConfig({ ...config, uri: 'mongodb://127.0.0.1/test', keyFile: '/private/key', directory, mongoConfigFile: '/private/config' })).rejects.toMatchObject({ code: 'BACKUP_INVALID_PATH' })
    await expect(loadLocalBackupConfig({ ...config, uri: 'mongodb://127.0.0.1/test', keyFile: 'relative', directory: 'relative' })).rejects.toMatchObject({ code: 'BACKUP_INVALID_PATH' })
  })
  it('rejects archive files without the correct envelope', async () => {
    await writeFile(path.join(directory, 'bad'), Buffer.alloc(50))
    await expect(verifyEncryptedBackup(path.join(directory, 'bad'), config.key)).rejects.toMatchObject({ code: 'BACKUP_INVALID_ARCHIVE' })
  })
  it('storage directory cannot be a file', async () => {
    const file = path.join(directory, 'file'); await writeFile(file, 'data')
    await expect(createLocalBackupAdapter({ ...config, directory: file }).check()).rejects.toMatchObject({ code: 'BACKUP_INVALID_PATH' })
  })
  it('requires explicit non-snapshot acknowledgment and rejects arbitrary paths in API body', () => {
    expect(backupSchema.safeParse({ reason: 'Valid backup reason', acknowledgeNonSnapshot: true }).success).toBe(true)
    for (const input of [{ reason: 'Valid backup reason' }, { reason: 'Valid backup reason', acknowledgeNonSnapshot: false }, { reason: 'Valid backup reason', acknowledgeNonSnapshot: true, path: '../arbitrary' }]) expect(backupSchema.safeParse(input).success).toBe(false)
    expect(backupsQuery.parse({})).toEqual({ limit: 20 }); expect(backupsQuery.safeParse({ limit: 101 }).success).toBe(false)
  })
})
